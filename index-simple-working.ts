import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("workshop123");

// Use existing namespace
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// PostgreSQL - reliable and simple
const postgresLabels = { app: "postgres" };
const postgres = new k8s.apps.v1.Deployment("postgres", {
  metadata: { name: "postgres", namespace: nsName },
  spec: {
    replicas: 1,
    selector: { matchLabels: postgresLabels },
    template: {
      metadata: { labels: postgresLabels },
      spec: {
        containers: [{
          name: "postgres",
          image: "bitnami/postgresql:15",
          env: [
            { name: "POSTGRESQL_DATABASE", value: "students" },
            { name: "POSTGRESQL_USERNAME", value: "user" },
            { name: "POSTGRESQL_PASSWORD", value: dbPassword },
          ],
          ports: [{ containerPort: 5432 }],
          readinessProbe: {
            exec: { command: ["pg_isready", "-U", "user", "-d", "students"] },
            initialDelaySeconds: 10, periodSeconds: 5
          }
        }]
      }
    }
  }
}, { provider: namespaceProvider });

const postgresSvc = new k8s.core.v1.Service("postgres-svc", {
  metadata: { name: "postgres-svc", namespace: nsName },
  spec: { selector: postgresLabels, ports: [{ port: 5432 }] }
}, { dependsOn: [postgres], provider: namespaceProvider });

// Web app using a simple, reliable public image
const appLabels = { app: "web" };
const appDeployment = new k8s.apps.v1.Deployment("web", {
  metadata: { name: "web", namespace: nsName },
  spec: {
    replicas: 1,
    selector: { matchLabels: appLabels },
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [{
          name: "web",
          // Simple Node.js app that works with PostgreSQL
          image: "quay.io/redhat-developer/nodejs-sample:latest",
          env: [
            { name: "DATABASE_URL", value: pulumi.interpolate`postgresql://user:${dbPassword}@postgres-svc:5432/students` },
            { name: "DB_HOST", value: "postgres-svc" },
            { name: "DB_USER", value: "user" },
            { name: "DB_PASSWORD", value: dbPassword },
            { name: "DB_NAME", value: "students" },
          ],
          ports: [{ containerPort: 8080 }]
        }]
      }
    }
  }
}, { dependsOn: [postgresSvc], provider: nam