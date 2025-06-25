#!/bin/bash

# IaC Workshop Setup Script
# This script sets up the environment for students

echo "🚀 Setting up IaC Workshop Environment..."

# Set Pulumi passphrase to avoid repeated prompts
export PULUMI_CONFIG_PASSPHRASE="workshop123"
echo "export PULUMI_CONFIG_PASSPHRASE=\"workshop123\"" >> ~/.bashrc

# Verify student namespace is set
if [ -z "$STUDENT_NAMESPACE" ]; then
    echo "⚠️  STUDENT_NAMESPACE not set. Using student01 as default."
    export STUDENT_NAMESPACE="student01"
    echo "export STUDENT_NAMESPACE=\"student01\"" >> ~/.bashrc
fi

echo "✅ Student namespace: $STUDENT_NAMESPACE"
echo "✅ Pulumi passphrase: Set"

# Verify OpenShift authentication
if oc whoami > /dev/null 2>&1; then
    echo "✅ OpenShift: Authenticated as $(oc whoami)"
else
    echo "⚠️  OpenShift: Not authenticated. Run: oc login <cluster-url>"
fi

# Check if in correct directory
if [ -f "index.ts" ] && [ -f "Pulumi.yaml" ]; then
    echo "✅ Workshop files: Found"
else
    echo "⚠️  Workshop files: Not found. Run: git clone https://github.com/kevin-biot/IaC.git ."
fi

echo ""
echo "🎯 Ready for workshop! Next steps:"
echo "1. npm install"
echo "2. pulumi login --local"
echo "3. pulumi stack init dev"
echo "4. pulumi config set studentNamespace $STUDENT_NAMESPACE"
echo "5. pulumi preview"