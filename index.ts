import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use Tekton/Shipwright built image instead of Docker build
const imageName = `image-registry.openshift-image-registry.svc:5000/${nsName}/sample-form-app:latest`;

// Use existing namespace instead of creating new one
// This avoids conflicts when namespace already exists
const namespaceProvider = new k8s.Provider("k8s-provider", {
  namespace: nsName,
});

// Tekton BuildConfig for application image
const buildConfig = new k8s.apiextensions.CustomResource("sample-form-app-build", {
  apiVersion: "shipwright.io/v1alpha1",
  kind: "Build",
  metadata: { 
    name: "sample-form-app-build",
    namespace: nsName 
  },
  spec: {
    source: {
      url: "https://github.com/kevin-biot/IaC",
      contextDir: "app"
    },
    strategy: {
      name: "buildpacks-v3",
      kind: "BuildStrategy"
    },
    output: {
      image: imageName
    }
  }
}, { provider: namespaceProvider });

// Trigger the build
const buildRun = new k8s.apiextensions.CustomResource("sample-form-app-buildrun", {
  apiVersion: "shipwright.io/v1alpha1", 
  kind: "BuildRun",
  metadata: {
    name: "sample-form-app-buildrun",
    namespace: nsName
  },
  spec: {
    buildRef: {
      name: "sample-form-app-build"
    }
  }
}, { dependsOn: [buildConfig], provider: namespaceProvider });

const postgresLabels = { app: "postgres" };
const postgres = new k8s.apps.v1.Deployment("postgres", {
  metadata: { 
    name: "postgres",
    namespace: nsName 
  },
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

// RBAC with explicit name and proper dependencies
// Create Role first
const role = new k8s.rbac.v1.Role("web-role", {
  metadata: { 
    name: "web-role",
    namespace: nsName 
  },
  rules: [
    { apiGroups: [""], resources: ["configmaps"], verbs: ["get", "list"] },
    { apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] },
    { apiGroups: ["apps"], resources: ["deployments"], verbs: ["get", "list"] },
  ],
}, { provider: namespaceProvider });

// Create RoleBinding after Role
const roleBinding = new k8s.rbac.v1.RoleBinding("web-rolebinding", {
  metadata: { 
    name: "web-rolebinding",
    namespace: nsName 
  },
  subjects: [
    { kind: "ServiceAccount", name: "default", namespace: nsName },
  ],
  roleRef: {
    kind: "Role",
    name: "web-role",
    apiGroup: "rbac.authorization.k8s.io",
  },
}, { dependsOn: [role], provider: namespaceProvider });

// Export the application URL - construct it properly for OpenShift routes
export const appUrl = pulumi.interpolate`https://web-route-${nsName}.apps.cluster.local`;
export const routeName = "web-route";
export const buildStatus = "sample-form-app-buildrun";
export const namespace_name = nsName;