import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use Tekton Pipeline built image
const imageName = `image-registry.openshift-image-registry.svc:5000/${nsName}/sample-form-app:latest`;

// Use existing namespace
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// Create Shipwright Build (same as before, but will be triggered by Tekton)
const buildConfig = new k8s.apiextensions.CustomResource("sample-form-app-build", {
  apiVersion: "shipwright.io/v1beta1",
  kind: "Build",
  metadata: { 
    name: "sample-form-app-build",
    namespace: nsName 
  },
  spec: {
    source: {
      type: "Git",
      contextDir: ".",  // Use root directory
      git: {
        url: "https://github.com/kevin-biot/IaC",
        revision: "main"
      }
    },
    strategy: {
      name: "buildah",
      kind: "ClusterBuildStrategy"
    },
    output: {
      image: imageName
    },
    paramValues: [
      {
        name: "dockerfile",
        value: "app/Dockerfile"  // Point to Dockerfile in app subdirectory
      },
      {
        name: "storage-driver", 
        value: "vfs"
      }
    ]
  }
}, { provider: namespaceProvider });

// Create Tekton Pipeline Workspace (required for pipeline)
const pipelinePVC = new k8s.core.v1.PersistentVolumeClaim("pipeline-workspace", {
  metadata: {
    name: "pipeline-workspace",
    namespace: nsName
  },
  spec: {
    accessModes: ["ReadWriteOnce"],
    resources: {
      requests: {
        storage: "1Gi"
      }
    }
  }
}, { provider: namespaceProvider });

// Create Tekton Pipeline for Node.js app
const pipeline = new k8s.apiextensions.CustomResource("nodejs-build-pipeline", {
  apiVersion: "tekton.dev/v1beta1",
  kind: "Pipeline",
  metadata: {
    name: "nodejs-build-pipeline",
    namespace: nsName
  },
  spec: {
    params: [
      {
        name: "git-url",
        type: "string",
        description: "Public Git repo URL"
      },
      {
        name: "git-revision", 
        type: "string",
        description: "Branch, tag or commit",
        default: "main"
      },
      {
        name: "build-name",
        type: "string", 
        description: "Shipwright Build name"
      },
      {
        name: "namespace",
        type: "string",
        description: "Target OpenShift project"
      }
    ],
    workspaces: [
      {
        name: "source",
        description: "Where source is checked out"
      }
    ],
    tasks: [
      {
        name: "clone",
        taskRef: {
          name: "git-clone",
          kind: "ClusterTask"
        },
        params: [
          {
            name: "url",
            value: "$(params.git-url)"
          },
          {
            name: "revision", 
            value: "$(params.git-revision)"
          }
        ],
        workspaces: [
          {
            name: "output",  // git-clone ClusterTask uses "output" workspace
            workspace: "source"
          }
        ]
      },
      {
        name: "build-nodejs",
        runAfter: ["clone"],
        taskRef: {
          name: "node-build",
          kind: "ClusterTask"
        },
        params: [
          {
            name: "source-dir",
            value: "app"
          }
        ],
        workspaces: [
          {
            name: "source",  // Our custom task uses "source" workspace
            workspace: "source"
          }
        ]
      },
      {
        name: "shipwright",
        runAfter: ["build-nodejs"],
        taskRef: {
          name: "shipwright-trigger",
          kind: "ClusterTask"
        },
        params: [
          {
            name: "BUILD_NAME",
            value: "$(params.build-name)"
          },
          {
            name: "NAMESPACE",
            value: "$(params.namespace)"
          }
        ]
      },
      {
        name: "deploy",
        runAfter: ["shipwright"],
        taskRef: {
          name: "deploy-app",
          kind: "ClusterTask"
        },
        params: [
          {
            name: "NAMESPACE",
            value: "$(params.namespace)"
          },
          {
            name: "APP_NAME",
            value: "web"
          }
        ]
      }
    ]
  }
}, { dependsOn: [buildConfig], provider: namespaceProvider });

// Create PipelineRun to execute the pipeline
const pipelineRun = new k8s.apiextensions.CustomResource("nodejs-build-run", {
  apiVersion: "tekton.dev/v1beta1",
  kind: "PipelineRun", 
  metadata: {
    name: "nodejs-build-run",
    namespace: nsName
  },
  spec: {
    pipelineRef: {
      name: "nodejs-build-pipeline"
    },
    params: [
      {
        name: "git-url",
        value: "https://github.com/kevin-biot/IaC"
      },
      {
        name: "git-revision",
        value: "main"
      },
      {
        name: "build-name", 
        value: "sample-form-app-build"
      },
      {
        name: "namespace",
        value: nsName
      }
    ],
    workspaces: [
      {
        name: "source",
        persistentVolumeClaim: {
          claimName: "pipeline-workspace"
        }
      }
    ]
  }
}, { dependsOn: [pipeline, pipelinePVC], provider: namespaceProvider });

// PostgreSQL (same as before - working fine)
const postgresLabels = { app: "postgres" };
const postgres = new k8s.apps.v1.Deployment("postgres", {
  metadata: { 
    name: "postgres",
    namespace: nsName 
  },
  spec: {
    selector: { matchLabels: postgresLabels },
    template: {
      metadata: { 
        labels: postgresLabels
      },
      spec: {
        containers: [
          {
            name: "postgres",
            image: "docker.io/bitnami/postgresql:13",
            env: [
              { name: "POSTGRESQL_DATABASE", value: "students" },
              { name: "POSTGRESQL_USERNAME", value: "user" },
              { name: "POSTGRESQL_PASSWORD", value: dbPassword },
              { name: "POSTGRES_PASSWORD", value: dbPassword },
            ],
            ports: [{ containerPort: 5432 }],
            volumeMounts: [{
              name: "postgres-data",
              mountPath: "/bitnami/postgresql"
            }],
            readinessProbe: {
              exec: {
                command: ["pg_isready", "-U", "user", "-d", "students"]
              },
              initialDelaySeconds: 15,
              periodSeconds: 5
            },
            livenessProbe: {
              exec: {
                command: ["pg_isready", "-U", "user", "-d", "students"]
              },
              initialDelaySeconds: 30,
              periodSeconds: 10
            }
          },
        ],
        volumes: [{
          name: "postgres-data",
          emptyDir: {}
        }]
      },
    },
  },
}, { provider: namespaceProvider });

const postgresSvc = new k8s.core.v1.Service("postgres-svc", {
  metadata: { 
    name: "postgres-svc",
    namespace: nsName 
  },
  spec: {
    selector: postgresLabels,
    ports: [{ port: 5432 }],
  },
}, { dependsOn: [postgres], provider: namespaceProvider });

// Web application deployment (depends on pipeline completion)
const appLabels = { app: "web" };
const appDeployment = new k8s.apps.v1.Deployment("web", {
  metadata: { 
    name: "web",
    namespace: nsName 
  },
  spec: {
    selector: { matchLabels: appLabels },
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [
          {
            name: "web",
            image: imageName,  // Will be built by Tekton pipeline
            env: [
              { name: "DB_HOST", value: "postgres-svc" },
              { name: "DB_USER", value: "user" },
              { name: "DB_PASS", value: dbPassword },
              { name: "DB_NAME", value: "students" },
            ],
            ports: [{ containerPort: 8080 }],
          },
        ],
      },
    },
  },
}, { dependsOn: [pipelineRun, postgresSvc], provider: namespaceProvider });

const appSvc = new k8s.core.v1.Service("web-svc", {
  metadata: { 
    name: "web-svc",
    namespace: nsName 
  },
  spec: {
    selector: appLabels,
    ports: [{ port: 80, targetPort: 8080 }],
  },
}, { dependsOn: [appDeployment], provider: namespaceProvider });

// Expose via OpenShift Route
const route = new k8s.apiextensions.CustomResource("web-route", {
  apiVersion: "route.openshift.io/v1",
  kind: "Route",
  metadata: { 
    name: "web-route",
    namespace: nsName 
  },
  spec: {
    to: { kind: "Service", name: "web-svc" },
    port: { targetPort: 8080 },
  },
}, { dependsOn: [appSvc], provider: namespaceProvider });

// Export the application URL
export const appUrl = pulumi.interpolate`https://web-route-${nsName}.apps.cluster.local`;
export const routeName = "web-route";
export const buildStatus = "tekton-pipeline-build";
export const pipelineName = "nodejs-build-pipeline";
export const pipelineRunName = "nodejs-build-run";
export const namespace_name = nsName;