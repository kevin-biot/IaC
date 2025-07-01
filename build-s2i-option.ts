// Try source-to-image strategy instead
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
      git: {
        url: "https://github.com/kevin-biot/IaC",
        revision: "main"
      },
      contextDir: "app"
    },
    strategy: {
      name: "source-to-image",  // Try s2i instead
      kind: "ClusterBuildStrategy"
    },
    output: {
      image: imageName
    },
    paramValues: [
      {
        name: "builder-image",
        value: "registry.redhat.io/ubi8/nodejs-18:latest"
      }
    ]
  }
}, { provider: namespaceProvider });