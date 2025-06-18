# IaC Workshop Sample

This repository contains a basic Pulumi project that deploys a simple Node.js
form application backed by Postgres to an OpenShift cluster. Each student
deploys the application into their own namespace using Pulumi.

## Requirements

- Node.js and npm
- Pulumi CLI
- Access to an OpenShift cluster with permissions to create namespaces
- Docker installed and access to a container registry to push images

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your Pulumi stack. Replace `student01` with your assigned
   namespace.

   ```bash
   pulumi stack init dev    # if creating a new stack
   pulumi config set studentNamespace student01
   pulumi config set --secret dbPassword <db-password>   # optional
   ```

   Authenticate your Docker client to the cluster's image registry so the
   application image can be pushed:

   ```bash
   oc registry login
   ```

   By default the image is published to
   `image-registry.openshift-image-registry.svc:5000/<namespace>/sample-form-app:latest`.
   To use a different registry, also set the following configuration values:

   ```bash
   pulumi config set appImage <registry>/sample-form-app:latest
   pulumi config set registry.username <registry-user>
   pulumi config set --secret registry.password <registry-password>
   ```

3. Deploy:
   ```bash
   pulumi up
   ```

4. After deployment completes, Pulumi will output the route URL. Visit this URL
   in your browser to see the form application.

## Application

The application source is in the `app/` directory. It is a small Express server
that stores submitted names in Postgres and displays the list of entries.
Pulumi builds a Docker image from this directory and pushes it to the registry
specified in the Pulumi configuration.
