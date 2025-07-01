import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use Tekton/Shipwright built image instead of Docker build
const imageName = `image-registry.openshift-image-registry.svc:5000/${nsName}/sample-form-app:latest`;

// Use existing namespace instead of creating new one
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// Tekton BuildConfig for application image using buildah (like java-webapp)
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
      contextDir: "app",
      git: {
        url: "https://github.com/kevin-biot/IaC",
        revision: "main"
      }
    },
    strategy: {
      name: "buildah",  // Use buildah like the working java-webapp
      kind: "ClusterBuildStrategy"
    },
    output: {
      image: imageName
    },
    paramValues: [
      {
        name: "dockerfile",
        value: "Dockerfile"
      },
      {
        name: "storage-driver",
        value: "vfs"
      }
    ]
  }
}, { provider: namespaceProvider });

// Trigger the build using v1beta1 API with required parameters
const buildRun = new k8s.apiextensions.CustomResource("sample-form-app-buildrun", {
  apiVersion: "shipwright.io/v1beta1", 
  kind: "BuildRun",
  metadata: {
    name: "sample-form-app-buildrun",
    namespace: nsName
  },
  spec: {
    build: {
      name: "sample-form-app-build"
    },
    paramValues: [
      {
        name: "shp-source-root",
        value: "app"
      },
      {
        name: "shp-output-image", 
        value: imageName
      }
    ]
  }
}, { dependsOn: [buildConfig], provider: namespaceProvider });

// Use Bitnami PostgreSQL (this is working)
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

// Deploy web app using existing java-webapp image (temporary)
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
            image: imageName,  // Using our built Node.js image
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
}, { dependsOn: [buildRun, postgresSvc], provider: namespaceProvider });

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
export const buildStatus = "using-existing-java-webapp-image";
export const namespace_name = nsName;