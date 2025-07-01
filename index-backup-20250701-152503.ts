import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use pre-built image from instructor namespace
const imageName = `image-registry.openshift-image-registry.svc:5000/devops/nodejs-form-app:latest`;

// Use existing namespace
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// PostgreSQL (working perfectly)
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

// Web application deployment using pre-built image
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
            image: imageName,  // Pre-built by instructor
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
}, { dependsOn: [postgresSvc], provider: namespaceProvider });

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
export const buildStatus = "pre-built-by-instructor";
export const imageUsed = imageName;
export const namespace_name = nsName;