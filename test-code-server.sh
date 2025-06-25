#!/bin/bash

# IaC Workshop Test Script for Code-Server Environment
# Run this inside a student's code-server terminal

set -e

echo "🧪 IaC Workshop Test - Code-Server Environment"
echo "=============================================="
echo "Student: $STUDENT_NAMESPACE"
echo "Hostname: $HOSTNAME"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((TESTS_FAILED++))
    fi
}

info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

# Test 1: Code-Server Environment
echo "🔧 Testing Code-Server Environment..."
echo "------------------------------------"

info "Checking user and environment..."
whoami | grep -q "coder"
test_result "Running as coder user"

[ -n "$STUDENT_NAMESPACE" ]
test_result "STUDENT_NAMESPACE set: $STUDENT_NAMESPACE"

[ -d "/home/coder/workspace" ]
test_result "Workspace directory exists"

# Test 2: Tool Prerequisites
echo ""
echo "🔧 Testing Pre-installed Tools..."
echo "--------------------------------"

node --version | grep -E "v1[6-9]|v[2-9][0-9]" > /dev/null
test_result "Node.js 16+ available"

npm --version > /dev/null
test_result "npm available"

pulumi version > /dev/null
test_result "Pulumi CLI available"

oc version --client > /dev/null
test_result "OpenShift CLI available"

git --version > /dev/null
test_result "Git available"

# Test 3: OpenShift Connectivity
echo ""
echo "🔧 Testing OpenShift Access..."
echo "-----------------------------"

oc whoami > /dev/null 2>&1
if [ $? -eq 0 ]; then
    USER=$(oc whoami)
    echo -e "${GREEN}✅ PASS${NC}: Authenticated to OpenShift as $USER"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Not authenticated to OpenShift"
fi

oc get ns $STUDENT_NAMESPACE > /dev/null 2>&1
test_result "Student namespace accessible: $STUDENT_NAMESPACE"

oc registry info > /dev/null 2>&1
test_result "OpenShift registry accessible"

# Test 4: Workshop Repository
echo ""
echo "🔧 Testing Workshop Setup..."
echo "---------------------------"

# Check if we're in the right directory structure
if [ -f "index.ts" ] && [ -f "Pulumi.yaml" ] && [ -d "app" ]; then
    echo -e "${GREEN}✅ PASS${NC}: IaC workshop files present"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: IaC workshop files not found. Need to clone repository?"
    echo "Expected files: index.ts, Pulumi.yaml, app/"
fi

# Test npm dependencies
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ PASS${NC}: npm dependencies installed"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: npm dependencies not installed. Run: npm install"
fi

# Test 5: Pulumi Configuration
echo ""
echo "🔧 Testing Pulumi Setup..."
echo "-------------------------"

pulumi whoami > /dev/null 2>&1
if [ $? -eq 0 ]; then
    USER=$(pulumi whoami)
    echo -e "${GREEN}✅ PASS${NC}: Pulumi authenticated as $USER"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Pulumi not authenticated. May use local backend."
fi

# Test 6: Quick Deployment Test (Optional)
echo ""
echo "🚀 Optional: Quick Deployment Test"
echo "=================================="

if [ -f "index.ts" ] && [ -f "Pulumi.yaml" ]; then
    read -p "Run a deployment test? This creates real resources. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Starting deployment test..."
        
        # Initialize if needed
        pulumi stack select test-validation 2>/dev/null || pulumi stack init test-validation
        
        # Set configuration
        pulumi config set studentNamespace $STUDENT_NAMESPACE
        pulumi config set --secret dbPassword TestPassword123
        
        # Preview
        info "Running pulumi preview..."
        pulumi preview --non-interactive
        test_result "Pulumi preview successful"
        
        # Deploy (with timeout for code-server environment)
        info "Running pulumi up (this may take 10-15 minutes in code-server)..."
        timeout 900 pulumi up --yes --non-interactive
        test_result "Pulumi deployment successful"
        
        if [ $? -eq 0 ]; then
            # Test application
            info "Testing application..."
            APP_URL=$(pulumi stack output appUrl 2>/dev/null || echo "")
            if [ -n "$APP_URL" ]; then
                sleep 15  # Wait for pods to be ready
                curl -f -s "$APP_URL" > /dev/null
                test_result "Application accessible at $APP_URL"
            else
                echo -e "${YELLOW}⚠️  WARN${NC}: Could not get application URL"
            fi
            
            # Cleanup
            info "Cleaning up test resources..."
            pulumi destroy --yes --non-interactive
            test_result "Resource cleanup successful"
        fi
        
        # Remove test stack
        pulumi stack rm test-validation --yes 2>/dev/null || true
    else
        info "Skipping deployment test"
    fi
else
    info "Skipping deployment test - workshop files not found"
fi

# Test Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 Code-server environment ready for IaC workshop!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Clone the workshop repository if not done already"
    echo "2. Run 'npm install' to install dependencies"  
    echo "3. Follow the workshop README instructions"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please address issues above.${NC}"
    exit 1
fi