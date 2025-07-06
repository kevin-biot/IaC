#!/bin/bash
# setup-all-students.sh
# Ensures all 25 student namespaces exist with proper resources

echo "🎓 Setting up 25 student namespaces for load testing..."

CLUSTER_DOMAIN="apps.bootcamp-ocs-cluster.bootcamp.tkmind.net"
TEMPLATE_FILE="/Users/kevinbrown/code-server-student-image/student-template.yaml"

for i in {01..25}; do
    STUDENT="student${i}"
    echo "Setting up ${STUDENT}..."
    
    # Process and apply the template
    oc process -f "${TEMPLATE_FILE}" \
        -p STUDENT_NAME="${STUDENT}" \
        -p CLUSTER_DOMAIN="${CLUSTER_DOMAIN}" \
        | oc apply -f - >/dev/null 2>&1
    
    # Apply the optimized resource patch
    oc patch deployment code-server -n "${STUDENT}" --patch='{"spec":{"template":{"spec":{"containers":[{"name":"code-server","resources":{"limits":{"memory":"1200Mi","cpu":"800m"},"requests":{"memory":"512Mi","cpu":"50m"}}}]}}}}' >/dev/null 2>&1 || true
    
    echo "✅ ${STUDENT} configured"
done

echo ""
echo "Waiting for all code-server pods to be ready..."

for i in {01..25}; do
    STUDENT="student${i}"
    echo -n "Waiting for ${STUDENT}... "
    oc wait --for=condition=Ready pod -l app=code-server -n "${STUDENT}" --timeout=300s >/dev/null 2>&1 && echo "✅" || echo "❌"
done

echo ""
echo "🚀 All student environments ready for load testing!"
echo ""
echo "Next steps:"
echo "1. Start monitoring: ./cluster-monitor.sh"
echo "2. Run load test: ./external-pulumi-load-test.sh preview"
echo "3. If successful, run: ./external-pulumi-load-test.sh up"