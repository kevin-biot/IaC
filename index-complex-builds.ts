import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use Tekton/Shipwright built image
const imageName = `image-registry.openshift-image-registry.svc:5000/${nsName}/sample-form-app:latest`;

// Use existing namespace
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// Create Shipwright Build (exactly like working java-webapp)
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
      contextDir: ".",  // Use root like java-webapp
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
        value: "app/Dockerfile"  // Point to app/Dockerfile
      },
      {
        name: "storage-driver", 
        value: "vfs"
      }
    ]
  }
}, { provider: namespaceProvider });

// Simple Tekton Task to trigger BuildRun (like java-webapp did)
const triggerTask = new k8s.apiextensions.CustomResource("trigger-build-task", {
  apiVersion: "tekton.dev/v1beta1",
  kind: "Task",
  metadata: {
    name: "trigger-build-task",
    namespace: nsName
  },
  spec: {
    params: [
      {
        name: "BUILD_NAME",
        type: "string"
      },
      {
        name: "NAMESPACE", 
        type: "string"
      }
    ],
    steps: [
      {
        name: "create-buildrun",
        image: "quay.io/openshift/origin-cli:latest",
        script: `
          #!/bin/bash
          set -e
          
          BUILD_NAME="$(params.BUILD_NAME)"
          NAMESPACE="$(params.NAMESPACE)"
          BUILDRUN_NAME="\${BUILD_NAME}-run-$(date +%s)"
          
          echo "Creating BuildRun: \$BUILDRUN_NAME"
          
          cat << EOF | oc apply -f -
          apiVersion: shipwright.io/v1beta1
          kind: BuildRun
          metadata:
            name: \$BUILDRUN_NAME
            namespace: \$NAMESPACE
          spec:
            build:
              name: \$BUILD_NAME
          EOF
          
          echo "Waiting for BuildRun completion..."
          oc wait --for=condition=Succeeded=true buildrun/\$BUILDRUN_NAME -n \$NAMESPACE --timeout=10m
        `
      }
    ]
  }
}, { dependsOn: [buildConfig], provider: namespaceProvider });

// TaskRun to execute the build trigger (like java-webapp)
const buildTaskRun = new k8s.apiextensions.CustomResource("build-trigger-run", {
  apiVersion: "tekton.dev/v1beta1",
  kind: "TaskRun",
  metadata: {
    name: "build-trigger-run",
    namespace: nsName
  },
  spec: {
    taskRef: {
      name: "trigger-build-task"
    },
    params: [
      {
        name: "BUILD_NAME",
        value: "sample-form-app-build"
      },
      {
        name: "NAMESPACE",
        value: nsName
      }
    ]
  }
}, { dependsOn: [triggerTask], provider: namespaceProvider });

// PostgreSQL (working fine)
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

// Web application deployment (depends on build completion)
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
            image: imageName,
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
}, { dependsOn: [buildTaskRun, postgresSvc], provider: namespaceProvider });

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
export const buildStatus = "tekton-triggered-buildrun";
export const namespace_name = nsName;