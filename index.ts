import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const config = new pulumi.Config();
const nsName = config.require("studentNamespace");
const dbPassword = config.getSecret("dbPassword") || pulumi.secret("password");

// Use Tekton/Shipwright built image instead of Docker build
const imageName = `image-registry.openshift-image-registry.svc:5000/${nsName}/sample-form-app:latest`;

const namespace = new k8s.core.v1.Namespace(nsName, {
  metadata: { name: nsName },
});

// Tekton BuildConfig for application image
const buildConfig = new k8s.apiextensions.CustomResource("sample-form-app-build", {
  apiVersion: "shipwright.io/v1alpha1",
  kind: "Build",
  metadata: { 
    name: "sample-form-app-build",
    namespace: namespace.metadata.name 
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
}, { dependsOn: [namespace] });

// Trigger the build
const buildRun = new k8s.apiextensions.CustomResource("sample-form-app-buildrun", {
  apiVersion: "shipwright.io/v1alpha1", 
  kind: "BuildRun",
  metadata: {
    name: "sample-form-app-buildrun",
    namespace: namespace.metadata.name
  },
  spec: {
    buildRef: {
      name: buildConfig.metadata.name
    }
  }
}, { dependsOn: [buildConfig] });

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
}, { dependsOn: [namespace] });

const postgresSvc = new k8s.core.v1.Service("postgres-svc", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: postgresLabels,
    ports: [{ port: 5432 }],
  },
}, { dependsOn: [postgres] });

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
            image: imageName,
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
}, { dependsOn: [buildRun, postgresSvc] });

const appSvc = new k8s.core.v1.Service("web-svc", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: appLabels,
    ports: [{ port: 80, targetPort: 8080 }],
  },
}, { dependsOn: [appDeployment] });

// Expose via OpenShift Route
const route = new k8s.apiextensions.CustomResource("web-route", {
  apiVersion: "route.openshift.io/v1",
  kind: "Route",
  metadata: { 
    name: "web-route",
    namespace: namespace.metadata.name 
  },
  spec: {
    to: { kind: "Service", name: appSvc.metadata.name },
    port: { targetPort: 8080 },
  },
}, { dependsOn: [appSvc] });

// RBAC with explicit name and proper dependencies
const roleName = "web-role";
const role = new k8s.rbac.v1.Role("web-role", {
  metadata: { 
    name: roleName,
    namespace: namespace.metadata.name 
  },
  rules: [
    { apiGroups: [""], resources: ["configmaps"], verbs: ["get", "list"] },
    { apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] },
    { apiGroups: ["apps"], resources: ["deployments"], verbs: ["get", "list"] },
  ],
}, { dependsOn: [namespace] });

const roleBinding = new k8s.rbac.v1.RoleBinding("web-rolebinding", {
  metadata: { 
    name: "web-rolebinding",
    namespace: namespace.metadata.name 
  },
  subjects: [
    { kind: "ServiceAccount", name: "default", namespace: nsName },
  ],
  roleRef: {
    kind: "Role",
    name: roleName,  // Use explicit string instead of resource reference
    apiGroup: "rbac.authorization.k8s.io",
  },
}, { dependsOn: [role] });

// Export the application URL - construct it properly for OpenShift routes
// Note: The actual domain will be determined by the OpenShift cluster configuration
export const appUrl = pulumi.interpolate`https://web-route-${nsName}.apps.cluster.local`;
export const routeName = route.metadata.name;
export const buildStatus = buildRun.metadata.name;
export const namespace_name = namespace.metadata.name;