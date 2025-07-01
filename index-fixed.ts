import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("workshop123");

// Use the image built by Shipwright in the devops namespace
const imageName = `image-registry.openshift-image-registry.svc:5000/devops/nodejs-form-app:latest`;

// Use existing namespace
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// PostgreSQL deployment - using reliable bitnami image
const postgresLabels = { app: "postgres" };
const postgres = new k8s.apps.v1.Deployment("postgres", {
  metadata: { 
    name: "postgres",
    namespace: nsName 
  },
  spec: {
    replicas: 1,
    selector: { matchLabels: postgresLabels },
    template: {
      metadata: { labels: postgresLabels },
      spec: {
        containers: [
          {
            name: "postgres",
            image: "bitnami/postgresql:15",
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
    ports: [{ port: 5432, targetPort: 5432 }],
  },
}, { dependsOn: [postgres], provider: namespaceProvider });

// Web application deployment using the Shipwright-built image
const appLabels = { app: "web" };
const appDeployment = new k8s.apps.v1.Deployment("web", {
  metadata: { 
    name: "web",
    namespace: nsName 
  },
  spec: {
    replicas: 1,
    selector: { matchLabels: appLabels },
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [
          {
            name: "web",
            image: imageName,
            imagePullPolicy: "Always",
            env: [
              { name: "DB_HOST", value: "postgres-svc" },
              { name: "DB_USER", value: "user" },
              { name: "DB_PASS", value: dbPassword },
              { name: "DB_NAME", value: "students" },
            ],
            ports: [{ containerPort: 8080 }],
            readinessProbe: {
              httpGet: {
                path: "/",
                port: 8080
              },
              initialDelaySeconds: 10,
              periodSeconds: 5
            },
            livenessProbe: {
              httpGet: {
                path: "/",
                port: 8080
              },
              initialDelaySeconds: 30,
              periodSeconds: 10
            }
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
    type: "ClusterIP"
  },
}, { dependsOn: [appDeployment], provider: namespaceProvider });

// Create OpenShift Route for external access
const route = new k8s.apiextensions.CustomResource("web-route", {
  apiVersion: "route.openshift.io/v1",
  kind: "Route",
  metadata: { 
    name: "web-route",
    namespace: nsName 
  },
  spec: {
    to: { 
      kind: "Service", 
      name: "web-svc",
      weight: 100
    },
    port: { 
      targetPort: 8080 
    },
  },
}, { dependsOn: [appSvc], provider: namespaceProvider });

// Exports for easy monitoring
export const namespace_name = nsName;
export const appUrl = pulumi.interpolate`https://web-route-${nsName}.apps.cluster.local`;
export const imageUsed = imageName;
export const buildStrategy = "shipwright-buildah-in-devops-namespace";
export const databaseStatus = "PostgreSQL-bitnami-15";
export const routeName = route.metadata.name;