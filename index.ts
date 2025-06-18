import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as docker from "@pulumi/docker";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

const imageName = config.get("appImage") || `sample-form-app:${nsName}`;
const registry = config.getObject<docker.ImageRegistry>("registry");

// Build and push the application image
const appImage = new docker.Image("app-image", {
  build: "./app",
  imageName: imageName,
  registry: registry,
});

const namespace = new k8s.core.v1.Namespace(nsName, {
  metadata: { name: nsName },
});

const postgresLabels = { app: "postgres" };
const postgres = new k8s.apps.v1.Deployment("postgres", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: { matchLabels: postgresLabels },
    template: {
      metadata: { labels: postgresLabels },
      spec: {
        containers: [
          {
            name: "postgres",
            image: "postgres:16",
            env: [
              { name: "POSTGRES_DB", value: "students" },
              { name: "POSTGRES_USER", value: "user" },
              { name: "POSTGRES_PASSWORD", value: dbPassword },
            ],
            ports: [{ containerPort: 5432 }],
          },
        ],
      },
    },
  },
});

const postgresSvc = new k8s.core.v1.Service("postgres-svc", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: postgresLabels,
    ports: [{ port: 5432 }],
  },
});

const appLabels = { app: "web" };
const appDeployment = new k8s.apps.v1.Deployment("web", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: { matchLabels: appLabels },
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [
          {
            name: "web",
            image: appImage.imageName,
            env: [
              { name: "DB_HOST", value: postgresSvc.metadata.name },
              { name: "DB_USER", value: "user" },
              { name: "DB_PASS", value: dbPassword.apply(p => p) },
              { name: "DB_NAME", value: "students" },
            ],
            ports: [{ containerPort: 8080 }],
          },
        ],
      },
    },
  },
});

const appSvc = new k8s.core.v1.Service("web-svc", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: appLabels,
    ports: [{ port: 80, targetPort: 8080 }],
  },
});

// Expose via OpenShift Route if available
const route = new k8s.apiextensions.CustomResource("web-route", {
  apiVersion: "route.openshift.io/v1",
  kind: "Route",
  metadata: { namespace: namespace.metadata.name },
  spec: {
    to: { kind: "Service", name: appSvc.metadata.name },
    port: { targetPort: 8080 },
  },
});

// Example RBAC
const role = new k8s.rbac.v1.Role("web-role", {
  metadata: { namespace: namespace.metadata.name },
  rules: [
    { apiGroups: [""], resources: ["configmaps"], verbs: ["get", "list"] },
  ],
});

new k8s.rbac.v1.RoleBinding("web-rolebinding", {
  metadata: { namespace: namespace.metadata.name },
  subjects: [
    { kind: "ServiceAccount", name: "default", namespace: namespace.metadata.name },
  ],
  roleRef: {
    kind: "Role",
    name: role.metadata.name,
    apiGroup: "rbac.authorization.k8s.io",
  },
});

export const appUrl = route.status.apply(s => `http://${s.ingress[0].host}`);
