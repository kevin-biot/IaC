#!/bin/bash
# validate-fixes.sh - Test the Pulumi fixes

set -e

echo "🔍 Validating Pulumi fixes for RBAC dependency issue..."

# Check current directory
if [[ ! -f "index.ts" ]]; then
    echo "❌ Please run this from the IaC directory containing index.ts"
    exit 1
fi

# Check if student namespace is set
if [[ -z "$STUDENT_NAMESPACE" ]]; then
    echo "❌ STUDENT_NAMESPACE environment variable not set"
    echo "💡 Run: export STUDENT_NAMESPACE=student04 (or your student number)"
    exit 1
fi

echo "✅ Student namespace: $STUDENT_NAMESPACE"

# Check Pulumi configuration
echo "🔧 Checking Pulumi configuration..."
if ! pulumi config get studentNamespace >/dev/null 2>&1; then
    echo "❌ Pulumi studentNamespace not configured"
    echo "💡 Run: pulumi config set studentNamespace \$STUDENT_NAMESPACE"
    exit 1
fi

if ! pulumi config get dbPassword >/dev/null 2>&1; then
    echo "❌ Pulumi dbPassword not configured"
    echo "💡 Run: pulumi config set --secret dbPassword MySecurePassword123"
    exit 1
fi

echo "✅ Pulumi configuration looks good"

# Test preview (this should work now)
echo "🧪 Testing Pulumi preview..."
if ! pulumi preview; then
    echo "❌ Pulumi preview failed"
    echo "💡 Check the error messages above"
    exit 1
fi

echo "✅ Pulumi preview succeeded!"

# Check if Tekton resources are applied
echo "🔧 Checking Tekton resources..."
if ! oc get pipeline student-build-deploy -n "$STUDENT_NAMESPACE" >/dev/null 2>&1; then
    echo "❌ Tekton pipeline not found"
    echo "💡 Run: oc apply -f tekton/"
    exit 1
fi

echo "✅ Tekton resources are ready"

# Optional: Check if we're ready to deploy
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Run: pulumi up"
echo "2. Wait for build to complete: oc get buildruns -n \$STUDENT_NAMESPACE"
echo "3. Check route: oc get route -n \$STUDENT_NAMESPACE"
echo ""
echo "🎯 All validation checks passed!"
