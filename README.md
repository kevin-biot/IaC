# Infrastructure as Code Workshop - Hands-On Lab

This repository contains a complete Pulumi project that demonstrates Infrastructure as Code principles by deploying a Node.js web application with PostgreSQL database to an OpenShift cluster using **Tekton/Shipwright** for cloud-native builds.

## 🎯 What You'll Build

A modern cloud-native application that includes:
- **Frontend**: HTML form interface served by Express.js
- **Backend**: Node.js API server
- **Database**: PostgreSQL for data persistence
- **CI/CD Pipeline**: Tekton/Shipwright for image builds
- **Infrastructure**: Automated deployment using Pulumi and OpenShift

## 📋 Prerequisites

### Required Software
Your code-server environment includes all necessary tools:

- ✅ **Node.js 20+** - Pre-installed in code-server
- ✅ **npm** - Package manager
- ✅ **Pulumi CLI** - Infrastructure as Code tool
- ✅ **OpenShift CLI (oc)** - Kubernetes management
- ✅ **Tekton CLI (tkn)** - Pipeline management
- ✅ **VS Code Interface** - Web-based development environment

### Required Access
- ✅ **OpenShift cluster access** - Pre-configured
- ✅ **Student namespace** - Automatically assigned (`$STUDENT_NAMESPACE`)
- ✅ **Container registry** - OpenShift internal registry

## 🚀 Quick Start Guide

### Step 1: Clone and Setup
```bash
# Clone the repository to your current directory
git clone https://github.com/kevin-biot/IaC.git .

# Install Node.js dependencies
npm install
```

### Step 2: Initialize Your Pulumi Stack
```bash
# Use local backend (no external account needed)
pulumi login --local

# Set a simple passphrase for the workshop
export PULUMI_CONFIG_PASSPHRASE="workshop123"

# Create a new Pulumi stack
pulumi stack init dev
```

### Step 3: Configure Your Environment
```bash
# Set your assigned namespace (should already be set)
pulumi config set studentNamespace $STUDENT_NAMESPACE

# Set a secure database password
pulumi config set --secret dbPassword MySecurePassword123

# Verify your configuration
pulumi config
```

### Step 4: Deploy Prerequisites
First, set up the Tekton/Shipwright build infrastructure:
```bash
# Apply Tekton pipeline resources
oc apply -f tekton/

# Wait a moment for resources to be created
oc get builds,buildruns -n $STUDENT_NAMESPACE
```

### Step 5: Preview Your Deployment
```bash
# See what Pulumi will create (dry run)
pulumi preview
```

You should see resources like:
- ✅ Kubernetes Namespace
- ✅ Shipwright Build and BuildRun
- ✅ PostgreSQL Deployment and Service
- ✅ Web Application Deployment and Service
- ✅ OpenShift Route
- ✅ RBAC Role and RoleBinding

### Step 6: Deploy Your Infrastructure
```bash
# Deploy the infrastructure and trigger builds
pulumi up
```

When prompted, type `yes` to confirm the deployment.

### Step 7: Monitor the Build Process
```bash
# Watch the Shipwright build process
oc get buildruns -n $STUDENT_NAMESPACE -w

# View build logs
oc logs -f buildrun/sample-form-app-buildrun -n $STUDENT_NAMESPACE

# Check when pods are ready
oc get pods -n $STUDENT_NAMESPACE
```

### Step 8: Access Your Application
After successful deployment:
```bash
# Get the application URL
pulumi stack output appUrl

# Check the actual route URL
oc get routes -n $STUDENT_NAMESPACE
```

Visit the route URL in your browser to see your deployed application!

## 🏗️ Understanding the New Architecture

### **Cloud-Native Build Process**
```
Code Changes → Tekton/Shipwright Build → Container Registry → Kubernetes Deployment
```

### **Key Components**
1. **Shipwright Build**: Converts source code to container images
2. **BuildRun**: Triggers the build process
3. **Pulumi Infrastructure**: Manages all Kubernetes resources
4. **OpenShift Routes**: Provides external access

## 🔍 Project Structure

```
IaC/
├── index.ts              # Main Pulumi program (Tekton-based)
├── Pulumi.yaml           # Project metadata
├── package.json          # Node.js dependencies (no Docker dependency)
├── tekton/               # Tekton/Shipwright resources
│   ├── buildstrategy.yaml    # Build strategy definition
│   ├── pipeline.yaml         # Tekton pipeline
│   └── pipeline-run.yaml     # Pipeline execution template
└── app/                  # Application source code
    ├── index.js          # Express.js web server
    ├── package.json      # App dependencies
    └── Dockerfile        # Container definition
```

## 🛠️ Making Changes

### Application Updates
```bash
# 1. Edit application code in VS Code
# 2. Trigger a new build
oc create -f tekton/pipeline-run.yaml

# 3. Monitor the build
tkn pipelinerun logs --last -f

# 4. Update infrastructure if needed
pulumi up
```

### Scaling Your Application
Edit `index.ts` and change the replica count:
```typescript
spec: {
  replicas: 3, // Change from 1 to 3
  // ... rest of configuration
}
```

Deploy the change:
```bash
pulumi preview  # See the planned change
pulumi up      # Apply the change
```

## 🔧 Workshop Exercises

### Exercise 1: Build and Deploy
1. **Trigger Build**: Create a new BuildRun
2. **Monitor Progress**: Watch build logs
3. **Verify Deployment**: Check pod status
4. **Test Application**: Access via browser

### Exercise 2: Update Application
1. **Edit Code**: Modify `app/index.js` 
2. **Rebuild Image**: Trigger new build
3. **Rolling Update**: Watch deployment update
4. **Verify Changes**: Test new functionality

### Exercise 3: Scale Infrastructure
1. **Edit Infrastructure**: Modify `index.ts`
2. **Preview Changes**: Use `pulumi preview`
3. **Apply Updates**: Deploy with `pulumi up`
4. **Monitor Scaling**: Watch pod creation

## 🔧 Troubleshooting

### Build Issues
```bash
# Check build status
oc get builds,buildruns -n $STUDENT_NAMESPACE

# View build logs
oc logs buildrun/sample-form-app-buildrun -n $STUDENT_NAMESPACE

# Check build strategy
oc describe buildstrategy buildpacks-v3
```

### Deployment Issues
```bash
# Check pod status
oc get pods -n $STUDENT_NAMESPACE

# View pod logs
oc logs deployment/web -n $STUDENT_NAMESPACE

# Check events
oc get events -n $STUDENT_NAMESPACE --sort-by='.lastTimestamp'
```

### Application Access Issues
```bash
# Verify route
oc get routes -n $STUDENT_NAMESPACE

# Test internal connectivity
oc rsh deployment/web -n $STUDENT_NAMESPACE
curl http://localhost:8080
```

## 🧹 Cleanup

```bash
# Destroy all Pulumi-managed resources
pulumi destroy

# Clean up any remaining Tekton resources
oc delete builds,buildruns --all -n $STUDENT_NAMESPACE

# Verify cleanup
oc get all -n $STUDENT_NAMESPACE
```

## 📚 Key Learning Outcomes

This workshop demonstrates:

1. **Cloud-Native Builds**: Using Tekton/Shipwright instead of local Docker
2. **Infrastructure as Code**: Pulumi with TypeScript
3. **Container Orchestration**: Kubernetes/OpenShift deployment patterns
4. **CI/CD Integration**: Automated build and deployment pipelines
5. **Configuration Management**: Secure secrets and environment-specific settings
6. **Dependency Management**: Proper resource ordering and relationships

## 🎯 Success Criteria

You've completed the workshop when:
- [ ] Shipwright build completes successfully
- [ ] Application pods are running
- [ ] Application is accessible via OpenShift route
- [ ] Form submission and data persistence work
- [ ] You've made and deployed at least one change
- [ ] All resources are properly cleaned up

## 🚀 What's Different (Tekton vs Docker Approach)

### **Before (Docker)**
- Students needed Docker installed locally
- Image builds happened on student machines
- Registry authentication complexity
- Local environment dependencies

### **After (Tekton/Shipwright)**
- ✅ **No local Docker required**
- ✅ **Cloud-native builds** in OpenShift
- ✅ **Automatic registry integration**
- ✅ **Enterprise-ready CI/CD patterns**
- ✅ **Consistent build environment**

## 🎉 Next Steps

After completing this workshop:

1. **Explore Tekton**: Learn about advanced pipeline features
2. **GitOps Integration**: Connect builds to Git webhooks  
3. **Multi-Environment**: Deploy to dev/staging/prod
4. **Security Scanning**: Add security checks to pipelines
5. **Monitoring**: Implement observability and alerts

**Welcome to modern, cloud-native infrastructure automation!** 🚀