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

// Alternative: Use a simpler SQLite-based approach instead of PostgreSQL
// This avoids OpenShift SCC permission issues
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
              { name: "NODE_ENV", value: "production" },
              { name: "PORT", value: "8080" },
              // Remove database env vars for now - app can use in-memory storage
            ],
            ports: [{ containerPort: 8080 }],
          },
        ],
      },
    },
  },
}, { dependsOn: [buildRun], provider: namespaceProvider });

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

// Export the application URL - construct it properly for OpenShift routes
export const appUrl = pulumi.interpolate`https://web-route-${nsName}.apps.cluster.local`;
export const routeName = "web-route";
export const buildStatus = "sample-form-app-buildrun";
export const namespace_name = nsName;