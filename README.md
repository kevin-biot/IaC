# Infrastructure as Code Workshop - Hands-On Lab

This repository contains a complete Pulumi project that demonstrates Infrastructure as Code principles by deploying a Node.js web application with PostgreSQL database to an OpenShift cluster.

## 🎯 What You'll Build

A simple but complete web application that includes:
- **Frontend**: HTML form interface served by Express.js
- **Backend**: Node.js API server
- **Database**: PostgreSQL for data persistence
- **Infrastructure**: Automated deployment using Pulumi and OpenShift

## 📋 Prerequisites

### Required Software
Before starting the workshop, ensure you have these tools installed:

- **Node.js** (version 16 or later) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Pulumi CLI** - [Installation guide](https://www.pulumi.com/docs/get-started/install/)
- **OpenShift CLI (oc)** - [Installation guide](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Text Editor/IDE** (VS Code, IntelliJ, etc.)

### Verify Installation
Run these commands to verify your setup:
```bash
node --version    # Should show v16.0.0 or later
npm --version     # Should show any recent version
pulumi version    # Should show v3.0.0 or later
oc version       # Should show both client and server versions
docker --version # Should show any recent version
```

### Required Access
- OpenShift cluster access (provided by instructor)
- Pulumi account (free at [app.pulumi.com](https://app.pulumi.com))
- Assigned student namespace (e.g., `student01`, `student02`, etc.)

## 🚀 Quick Start Guide

### Step 1: Clone and Setup
```bash
# Clone the repository (or download from instructor)
git clone <repository-url>
cd IaC

# Install Node.js dependencies
npm install
```

### Step 2: Initialize Your Pulumi Stack
```bash
# Create a new Pulumi stack for your work
pulumi stack init dev

# Login to Pulumi (follow the prompts)
pulumi login
```

### Step 3: Configure Your Environment
Replace `student01` with your assigned namespace:

```bash
# Set your assigned namespace
pulumi config set studentNamespace student01

# Set a secure database password
pulumi config set --secret dbPassword MySecurePassword123

# Verify your configuration
pulumi config
```

### Step 4: Authenticate to OpenShift
```bash
# Login to OpenShift cluster (get URL from instructor)
oc login <cluster-url>

# Authenticate Docker to the OpenShift registry
oc registry login
```

### Step 5: Preview Your Deployment
Always preview before deploying:
```bash
# See what Pulumi will create (dry run)
pulumi preview
```

You should see resources like:
- Kubernetes Namespace
- Docker Image build
- PostgreSQL Deployment and Service
- Web Application Deployment and Service
- OpenShift Route
- RBAC Role and RoleBinding

### Step 6: Deploy Your Infrastructure
```bash
# Deploy the infrastructure and application
pulumi up
```

When prompted, type `yes` to confirm the deployment.

### Step 7: Access Your Application
After successful deployment:
```bash
# Get the application URL
pulumi stack output appUrl

# Or view all outputs
pulumi stack output
```

Visit the URL in your browser to see your deployed application!

## 🔍 Understanding the Project Structure

```
IaC/
├── index.ts           # Main Pulumi program (infrastructure code)
├── Pulumi.yaml        # Project metadata and configuration
├── package.json       # Node.js dependencies for Pulumi
├── tsconfig.json      # TypeScript configuration
└── app/               # Application source code
    ├── index.js       # Express.js web server
    ├── package.json   # Application dependencies
    ├── Dockerfile     # Container build instructions
    └── .dockerignore  # Files to exclude from container
```

### Key Files Explained

**`index.ts`** - The main infrastructure program that defines:
- Kubernetes namespace for isolation
- Docker image build and registry push
- PostgreSQL database deployment
- Node.js application deployment
- OpenShift route for external access
- RBAC permissions

**`app/index.js`** - Simple Express.js application that:
- Serves HTML forms
- Handles form submissions
- Stores data in PostgreSQL
- Displays submitted entries

## 🛠️ Making Changes

### Scaling Your Application
Edit `index.ts` and change the replica count:
```typescript
spec: {
  replicas: 3, // Change from 1 to 3
  // ... rest of configuration
}
```

Then deploy the change:
```bash
pulumi preview  # See the planned change
pulumi up      # Apply the change
```

### Adding Environment Variables
Add new environment variables to your application:
```typescript
env: [
  { name: "DB_HOST", value: postgresSvc.metadata.name },
  { name: "DB_USER", value: "user" },
  { name: "DB_PASS", value: dbPassword.apply(p => p) },
  { name: "DB_NAME", value: "students" },
  { name: "APP_ENV", value: "workshop" }, // New variable
],
```

## 🔧 Troubleshooting Common Issues

### Image Push Failures
```bash
# Re-authenticate to the registry
oc registry login

# Check your namespace configuration
pulumi config get studentNamespace
```

### Pod Not Starting
```bash
# Check pod status in your namespace
oc get pods -n <your-namespace>

# View pod logs for errors
oc logs <pod-name> -n <your-namespace>

# Describe problematic resources
oc describe deployment web -n <your-namespace>
```

### Cannot Access Application
```bash
# Verify the route exists
oc get routes -n <your-namespace>

# Check route details
oc describe route web-route -n <your-namespace>
```

### Database Connection Issues
```bash
# Check if PostgreSQL pod is running
oc get pods -n <your-namespace> | grep postgres

# View PostgreSQL logs
oc logs deployment/postgres -n <your-namespace>
```

## 🧹 Cleanup

When you're finished with the workshop:

```bash
# Destroy all resources
pulumi destroy

# Confirm by typing 'yes' when prompted
```

Verify cleanup:
```bash
# Should show no resources
oc get all -n <your-namespace>
```

## 📚 What You're Learning

This workshop demonstrates several key concepts:

1. **Infrastructure as Code**: Managing infrastructure through code rather than manual processes
2. **Declarative Configuration**: Describing what you want, not how to achieve it
3. **State Management**: How Pulumi tracks and manages resource state
4. **Dependency Management**: Automatic ordering of resource creation and updates
5. **Configuration Management**: Separating environment-specific settings from code
6. **Container Orchestration**: Deploying and managing containerized applications
7. **Security**: Managing secrets and applying RBAC policies

## 🎯 Success Criteria

You've successfully completed the workshop when:
- [ ] Your application is accessible via the OpenShift route
- [ ] You can submit data through the web form
- [ ] Submitted data persists in the PostgreSQL database
- [ ] You can view the list of submitted entries
- [ ] You've made at least one change and redeployed
- [ ] You've cleaned up all resources

## ❓ Getting Help

**During the Workshop:**
- Raise your hand for instructor assistance
- Ask your neighbor or work in pairs
- Check the troubleshooting section above
- Don't hesitate to ask questions!

**After the Workshop:**
- [Pulumi Documentation](https://www.pulumi.com/docs/) - Comprehensive guides and API references
- [OpenShift Documentation](https://docs.openshift.com/) - Official OpenShift guides
- [Pulumi Examples](https://github.com/pulumi/examples) - Sample projects for different scenarios
- [Pulumi Community Slack](https://slack.pulumi.com/) - Get help from the community

## 🚀 Next Steps

After completing this workshop, consider exploring:

1. **Advanced Pulumi Features**:
   - [Component Resources](https://www.pulumi.com/docs/intro/concepts/resources/components/) for building reusable infrastructure
   - [Policy as Code](https://www.pulumi.com/docs/guides/crossguard/) for enforcing standards
   - [Testing Infrastructure](https://www.pulumi.com/docs/guides/testing/) with unit and integration tests

2. **Production Considerations**:
   - [CI/CD Integration](https://www.pulumi.com/docs/guides/continuous-delivery/) with GitHub Actions, GitLab, etc.
   - [State Backend Options](https://www.pulumi.com/docs/intro/concepts/state/) for team collaboration
   - [Secrets Management](https://www.pulumi.com/docs/intro/concepts/secrets/) best practices

3. **Other Cloud Providers**:
   - Try the same concepts with [AWS](https://www.pulumi.com/docs/get-started/aws/), [Azure](https://www.pulumi.com/docs/get-started/azure/), or [Google Cloud](https://www.pulumi.com/docs/get-started/gcp/)
   - Explore [multi-cloud deployments](https://www.pulumi.com/docs/guides/adopting/from_terraform/)

4. **Different Programming Languages**:
   - Try Pulumi with [Python](https://www.pulumi.com/docs/get-started/python/), [Go](https://www.pulumi.com/docs/get-started/go/), or [C#](https://www.pulumi.com/docs/get-started/dotnet/)

## 🏆 Workshop Completion

**Congratulations!** You've successfully learned to:
✅ Apply Infrastructure as Code principles  
✅ Use Pulumi for infrastructure automation  
✅ Deploy applications to OpenShift/Kubernetes  
✅ Manage configuration and secrets securely  
✅ Troubleshoot deployment issues  
✅ Make changes to live infrastructure safely  

Welcome to the world of modern infrastructure automation! 🎉