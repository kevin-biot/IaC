# Infrastructure as Code Workshop - Hands-On Lab

This repository contains a complete Pulumi project that demonstrates Infrastructure as Code principles by deploying a Node.js web application with PostgreSQL database to an OpenShift cluster.

## 🎯 What You'll Build

A modern cloud-native application that includes:
- **Frontend**: HTML form interface served by Express.js
- **Backend**: Node.js API server with database connectivity
- **Database**: PostgreSQL for data persistence
- **Infrastructure**: Automated deployment using Pulumi and OpenShift
- **External Access**: OpenShift Route for web access

## 📋 Prerequisites

### Your Environment
Your code-server environment includes all necessary tools:

- ✅ **Node.js 20+** - Pre-installed in code-server
- ✅ **npm** - Package manager
- ✅ **Pulumi CLI** - Infrastructure as Code tool
- ✅ **OpenShift CLI (oc)** - Kubernetes management
- ✅ **VS Code Interface** - Web-based development environment

### Pre-Configured Access
- ✅ **OpenShift cluster access** - Ready to use
- ✅ **Student namespace** - Automatically assigned (`$STUDENT_NAMESPACE`)
- ✅ **Container images** - Pre-built by instructor

## 🚀 Quick Start Guide

### Step 1: Clone and Setup Your Environment
```bash
# Clone the workshop repository
git clone https://github.com/kevin-biot/IaC.git
cd IaC

# Install Node.js dependencies
npm install

# Initialize Pulumi (no passphrase needed!)
pulumi login --local
pulumi stack init dev

# Configure your environment
pulumi config set studentNamespace $STUDENT_NAMESPACE
pulumi config set --secret dbPassword MySecurePassword123

# Verify configuration
pulumi config
```

### Step 2: Preview Your Infrastructure
```bash
# See what Pulumi will create (dry run)
pulumi preview
```

**You should see:**
- ✅ Kubernetes Provider for your namespace
- ✅ PostgreSQL Deployment and Service
- ✅ Web Application Deployment (using pre-built image)
- ✅ Web Application Service
- ✅ OpenShift Route for external access

### Step 3: Deploy Your Infrastructure
```bash
# Deploy everything (fast - no builds needed!)
pulumi up
```

When prompted, type `yes` to confirm the deployment.

### Step 4: Access Your Application
```bash
# Get your application URL
pulumi stack output appUrl

# Or check the route directly
oc get routes -n $STUDENT_NAMESPACE
```

Visit the route URL in your browser to see your deployed application!

## 🏗️ Architecture Overview

### **Simple Deployment Flow**
```
Pulumi Code → OpenShift API → Running Application
```

### **Key Components**
1. **PostgreSQL Database**: Bitnami PostgreSQL container with persistent storage
2. **Web Application**: Pre-built Node.js app connecting to database
3. **Kubernetes Services**: Internal networking between components
4. **OpenShift Route**: External access to your application
5. **Pulumi Stack**: Infrastructure state management

## 🔍 Project Structure

```
IaC/
├── index.ts              # Main Pulumi program
├── Pulumi.yaml           # Project metadata
├── package.json          # Node.js dependencies
├── instructor-setup.sh   # Instructor image building (pre-done)
├── setup-workshop.sh     # Workshop environment setup
└── app/                  # Application source code (for reference)
    ├── index.js          # Express.js web server
    ├── package.json      # App dependencies
    └── Dockerfile        # Container definition
```

## 📊 Understanding Your Infrastructure

### PostgreSQL Database
- **Image**: `bitnami/postgresql:15`
- **Database**: `students`
- **User**: `user`
- **Password**: Your configured secret
- **Storage**: EmptyDir (non-persistent for workshop)

### Web Application
- **Image**: Pre-built by instructor (`nodejs-form-app:latest`)
- **Port**: 8080
- **Environment**: Connected to PostgreSQL
- **Scaling**: 1 replica (can be increased)

### Networking
- **PostgreSQL Service**: `postgres-svc:5432` (internal only)
- **Web Service**: `web-svc:80` (internal)
- **OpenShift Route**: External HTTPS access

## 🛠️ Workshop Exercises

### Exercise 1: Basic Deployment ✅
1. **Preview Infrastructure**: `pulumi preview`
2. **Deploy Application**: `pulumi up`
3. **Verify Resources**: `oc get all -n $STUDENT_NAMESPACE`
4. **Test Application**: Visit your route URL

### Exercise 2: Explore Your Infrastructure
```bash
# Check running pods
oc get pods -n $STUDENT_NAMESPACE

# View pod logs
oc logs deployment/web -n $STUDENT_NAMESPACE
oc logs deployment/postgres -n $STUDENT_NAMESPACE

# Check services and routes
oc get svc,routes -n $STUDENT_NAMESPACE
```

### Exercise 3: Scale Your Application
Edit `index.ts` and change the replica count:
```typescript
const appDeployment = new k8s.apps.v1.Deployment("web", {
  spec: {
    replicas: 2, // Change from 1 to 2
    // ... rest of configuration
  }
});
```

Deploy the change:
```bash
pulumi preview  # See the planned change
pulumi up      # Apply the change

# Watch the scaling
oc get pods -n $STUDENT_NAMESPACE -w
```

### Exercise 4: Update Configuration
```bash
# Change the database password
pulumi config set --secret dbPassword NewPassword456

# Apply the change
pulumi up

# Watch pods restart with new configuration
oc get pods -n $STUDENT_NAMESPACE -w
```

## 🔧 Troubleshooting

### Common Issues

**Pods not starting?**
```bash
# Check pod status
oc get pods -n $STUDENT_NAMESPACE

# View pod events
oc describe pod <pod-name> -n $STUDENT_NAMESPACE

# Check logs
oc logs <pod-name> -n $STUDENT_NAMESPACE
```

**Application not accessible?**
```bash
# Verify route exists
oc get routes -n $STUDENT_NAMESPACE

# Test internal connectivity
oc rsh deployment/web -n $STUDENT_NAMESPACE
curl http://postgres-svc:5432  # Should connect
```

**Database connection issues?**
```bash
# Check PostgreSQL logs
oc logs deployment/postgres -n $STUDENT_NAMESPACE

# Verify environment variables
oc describe deployment web -n $STUDENT_NAMESPACE | grep -A 10 Environment
```

### Debug Commands
```bash
# Overall namespace health
oc get all -n $STUDENT_NAMESPACE

# Recent events
oc get events -n $STUDENT_NAMESPACE --sort-by='.lastTimestamp'

# Resource usage
oc top pods -n $STUDENT_NAMESPACE
```

## 🧹 Cleanup

```bash
# Destroy all Pulumi-managed resources
pulumi destroy

# Verify cleanup
oc get all -n $STUDENT_NAMESPACE

# Remove the stack (optional)
pulumi stack rm dev --force
```

## 📚 Key Learning Outcomes

This workshop demonstrates:

1. **Infrastructure as Code**: Declarative infrastructure with Pulumi TypeScript
2. **Container Orchestration**: Kubernetes deployments, services, and networking
3. **Configuration Management**: Secure secrets and environment variables
4. **Service Discovery**: Internal DNS and service communication
5. **External Access**: OpenShift routes and ingress patterns
6. **State Management**: Pulumi stack state and resource tracking

## ✅ Success Criteria

You've completed the workshop when:
- [ ] `pulumi preview` shows your infrastructure plan
- [ ] `pulumi up` deploys successfully
- [ ] All pods are running: `oc get pods -n $STUDENT_NAMESPACE`
- [ ] Application is accessible via OpenShift route
- [ ] Form submission works (data persists to PostgreSQL)
- [ ] You've successfully scaled the application
- [ ] All resources are properly cleaned up with `pulumi destroy`

## 🎯 What You've Learned

### Infrastructure as Code Benefits
- **Reproducible**: Same infrastructure every time
- **Version Controlled**: Infrastructure changes tracked in Git
- **Declarative**: Describe desired state, not steps
- **Automated**: No manual clicking or configuration

### OpenShift/Kubernetes Concepts
- **Deployments**: Manage application replicas and updates
- **Services**: Provide stable networking for pods
- **Routes**: External access with automatic TLS
- **ConfigMaps/Secrets**: Secure configuration management

### Modern DevOps Practices
- **Declarative Configuration**: Infrastructure defined in code
- **Immutable Infrastructure**: Replace, don't modify
- **Secret Management**: Encrypted sensitive data
- **State Management**: Track and manage infrastructure changes

## 🚀 Next Steps

After completing this workshop, explore:

1. **Advanced Pulumi**: Cross-stack references, providers, components
2. **GitOps**: Connect infrastructure updates to Git workflows
3. **Multi-Environment**: Deploy to dev/staging/production
4. **Monitoring**: Add Prometheus metrics and alerting
5. **Security**: Implement network policies and RBAC
6. **CI/CD Integration**: Automate deployments with pipelines

**Congratulations on completing your Infrastructure as Code journey!** 🎉

---

## 🔗 Additional Resources

- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [OpenShift Documentation](https://docs.openshift.com/)
- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
- [TypeScript Pulumi Examples](https://github.com/pulumi/examples)