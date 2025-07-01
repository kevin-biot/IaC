#!/bin/bash
# setup-rbac.sh - Create RBAC resources separately

set -e

if [[ -z "$STUDENT_NAMESPACE" ]]; then
    echo "❌ STUDENT_NAMESPACE environment variable not set"
    exit 1
fi

echo "🔐 Creating RBAC resources for $STUDENT_NAMESPACE..."

# Create Role
cat << EOF | oc apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: web-role
  namespace: $STUDENT_NAMESPACE
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
EOF

# Create RoleBinding
cat << EOF | oc apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: web-rolebinding
  namespace: $STUDENT_NAMESPACE
subjects:
- kind: ServiceAccount
  name: default
  namespace: $STUDENT_NAMESPACE
roleRef:
  kind: Role
  name: web-role
  apiGroup: rbac.authorization.k8s.io
EOF

echo "✅ RBAC resources created successfully!"
