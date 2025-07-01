#!/bin/bash
# fix-postgres-openshift.sh - Alternative approach using anyuid SCC

set -e

if [[ -z "$STUDENT_NAMESPACE" ]]; then
    echo "❌ STUDENT_NAMESPACE environment variable not set"
    exit 1
fi

echo "🔧 Configuring PostgreSQL for OpenShift in namespace: $STUDENT_NAMESPACE"

# Option 1: Grant anyuid SCC to default service account (for workshop only)
echo "🔐 Granting anyuid SCC to default service account..."
oc adm policy add-scc-to-user anyuid -z default -n "$STUDENT_NAMESPACE"

echo "✅ PostgreSQL should now work with standard postgres:13 image"
echo "💡 You can now run: pulumi up"

echo ""
echo "📋 Alternative: If you prefer restricted SCC, use the updated index.ts"
echo "   which includes proper securityContext and user ID settings."
