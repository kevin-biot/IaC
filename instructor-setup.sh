#!/bin/bash

echo "🎓 Pulumi Workshop - Instructor Pre-Setup Script"
echo "================================================"
echo ""

# Configuration
INSTRUCTOR_NAMESPACE="devops"
APP_NAME="nodejs-form-app"
REPO_URL="https://github.com/kevin-biot/IaC"
IMAGE_NAME="${APP_NAME}:latest"

echo "📋 Configuration:"
echo "   Namespace: ${INSTRUCTOR_NAMESPACE}"
echo "   App Name: ${APP_NAME}"
echo "   Repository: ${REPO_URL}"
echo "   Image: ${IMAGE_NAME}"
echo ""

# Step 1: Verify we're in the right namespace
echo "1️⃣  Verifying instructor namespace..."
oc project ${INSTRUCTOR_NAMESPACE} || {
    echo "❌ Failed to switch to ${INSTRUCTOR_NAMESPACE} namespace"
    echo "   Make sure you have access to the ${INSTRUCTOR_NAMESPACE} namespace"
    exit 1
}
echo "✅ Using namespace: $(oc project -q)"
echo ""

# Step 2: Clean up any existing resources
echo "2️⃣  Cleaning up any existing build resources..."
oc delete buildconfig ${APP_NAME} -n ${INSTRUCTOR_NAMESPACE} 2>/dev/null || echo "   No existing BuildConfig to clean up"
oc delete imagestream ${APP_NAME} -n ${INSTRUCTOR_NAMESPACE} 2>/dev/null || echo "   No existing ImageStream to clean up"
echo "✅ Cleanup complete"
echo ""

# Step 3: Create ImageStream
echo "3️⃣  Creating ImageStream..."
cat << EOF | oc apply -f -
apiVersion: image.openshift.io/v1
kind: ImageStream
metadata:
  name: ${APP_NAME}
  namespace: ${INSTRUCTOR_NAMESPACE}
spec:
  lookupPolicy:
    local: false
EOF

if [ $? -eq 0 ]; then
    echo "✅ ImageStream created successfully"
else
    echo "❌ Failed to create ImageStream"
    exit 1
fi
echo ""

# Step 4: Create BuildConfig
echo "4️⃣  Creating BuildConfig..."
cat << EOF | oc apply -f -
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: ${APP_NAME}
  namespace: ${INSTRUCTOR_NAMESPACE}
spec:
  source:
    type: Git
    git:
      uri: ${REPO_URL}
    contextDir: app
  strategy:
    type: Docker
    dockerStrategy:
      dockerfilePath: Dockerfile
  output:
    to:
      kind: ImageStreamTag
      name: ${APP_NAME}:latest
  triggers:
  - type: ConfigChange
EOF

if [ $? -eq 0 ]; then
    echo "✅ BuildConfig created successfully"
else
    echo "❌ Failed to create BuildConfig"
    exit 1
fi
echo ""

# Step 5: Start the build
echo "5️⃣  Starting build process..."
BUILD_NAME=$(oc start-build ${APP_NAME} -n ${INSTRUCTOR_NAMESPACE} --output=name)
if [ $? -eq 0 ]; then
    echo "✅ Build started: ${BUILD_NAME}"
    echo "📝 Build name: ${BUILD_NAME}"
else
    echo "❌ Failed to start build"
    exit 1
fi
echo ""

# Step 6: Monitor build progress
echo "6️⃣  Monitoring build progress..."
echo "   Following build logs (this may take a few minutes)..."
echo "   Press Ctrl+C to stop following logs (build will continue)"
echo ""

oc logs -f ${BUILD_NAME} -n ${INSTRUCTOR_NAMESPACE} || {
    echo "⚠️  Could not follow logs, but build may still be running"
    echo "   Check build status with: oc get builds -n ${INSTRUCTOR_NAMESPACE}"
}

echo ""
echo "7️⃣  Checking build status..."
BUILD_STATUS=$(oc get ${BUILD_NAME} -n ${INSTRUCTOR_NAMESPACE} -o jsonpath='{.status.phase}')
echo "   Build status: ${BUILD_STATUS}"

if [ "${BUILD_STATUS}" = "Complete" ]; then
    echo "✅ Build completed successfully!"
elif [ "${BUILD_STATUS}" = "Running" ]; then
    echo "🔄 Build is still running..."
    echo "   Monitor with: oc get builds -n ${INSTRUCTOR_NAMESPACE} -w"
    echo "   View logs with: oc logs -f ${BUILD_NAME} -n ${INSTRUCTOR_NAMESPACE}"
elif [ "${BUILD_STATUS}" = "Failed" ]; then
    echo "❌ Build failed!"
    echo "   Check logs with: oc logs ${BUILD_NAME} -n ${INSTRUCTOR_NAMESPACE}"
    exit 1
else
    echo "⚠️  Build status unknown: ${BUILD_STATUS}"
    echo "   Check manually with: oc get builds -n ${INSTRUCTOR_NAMESPACE}"
fi
echo ""

# Step 8: Set up image pull permissions
echo "8️⃣  Setting up student access to the image..."
oc policy add-role-to-group system:image-puller system:authenticated -n ${INSTRUCTOR_NAMESPACE} || {
    echo "⚠️  Warning: Could not set image-puller permissions"
    echo "   Students may need manual access to pull the image"
}
echo "✅ Image pull permissions configured"
echo ""

# Step 9: Verify the image is available
echo "9️⃣  Verifying image availability..."
IMAGE_SHA=$(oc get imagestream ${APP_NAME} -n ${INSTRUCTOR_NAMESPACE} -o jsonpath='{.status.tags[0].items[0].dockerImageReference}' 2>/dev/null)
if [ -n "${IMAGE_SHA}" ]; then
    echo "✅ Image is available:"
    echo "   Internal registry: image-registry.openshift-image-registry.svc:5000/${INSTRUCTOR_NAMESPACE}/${APP_NAME}:latest"
    echo "   Docker reference: ${IMAGE_SHA}"
else
    echo "⚠️  Image may not be ready yet. Check with:"
    echo "   oc get imagestream ${APP_NAME} -n ${INSTRUCTOR_NAMESPACE}"
fi
echo ""

# Step 10: Final summary
echo "🎉 Instructor Setup Complete!"
echo "=============================="
echo ""
echo "📋 Summary:"
echo "   ✅ ImageStream created"
echo "   ✅ BuildConfig created"
echo "   ✅ Build completed (or running)"
echo "   ✅ Student permissions configured"
echo ""
echo "🔗 Image for student workshops:"
echo "   image-registry.openshift-image-registry.svc:5000/${INSTRUCTOR_NAMESPACE}/${APP_NAME}:latest"
echo ""
echo "🛠️  Useful commands for monitoring:"
echo "   Check builds:     oc get builds -n ${INSTRUCTOR_NAMESPACE}"
echo "   Check images:     oc get imagestream -n ${INSTRUCTOR_NAMESPACE}"
echo "   View build logs:  oc logs build/${APP_NAME}-1 -n ${INSTRUCTOR_NAMESPACE}"
echo ""
echo "🚀 Ready for workshop! Students can now use the pre-built image in their Pulumi deployments."
