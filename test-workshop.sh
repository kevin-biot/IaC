#!/bin/bash

# IaC Workshop Test Script for Mac M4 + CRC OpenShift
# Run this script to validate your workshop environment

set -e

echo "🧪 IaC Workshop Environment Test Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((TESTS_FAILED++))
    fi
}

# Helper function to print info
info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

# Test 1: Prerequisites
echo ""
echo "🔧 Testing Prerequisites..."
echo "----------------------------"

# Node.js version
info "Checking Node.js version..."
node --version | grep -E "v1[6-9]|v[2-9][0-9]" > /dev/null
test_result "Node.js version 16+"

# npm
info "Checking npm..."
npm --version > /dev/null
test_result "npm installed"

# Pulumi CLI
info "Checking Pulumi CLI..."
pulumi version > /dev/null
test_result "Pulumi CLI installed"

# OpenShift CLI
info "Checking OpenShift CLI..."
oc version --client > /dev/null
test_result "OpenShift CLI installed"

# Docker
info "Checking Docker..."
docker --version > /dev/null
test_result "Docker installed"

# Docker running
info "Checking if Docker is running..."
docker ps > /dev/null 2>&1
test_result "Docker daemon running"

# Test 2: CRC OpenShift Environment
echo ""
echo "🔧 Testing CRC OpenShift Environment..."
echo "---------------------------------------"

# CRC status
info "Checking CRC status..."
crc status | grep -q "Running"
test_result "CRC OpenShift cluster running"

# CRC resources
info "Checking CRC resource allocation..."
MEMORY=$(crc config get memory)
CPUS=$(crc config get cpus)
info "CRC Memory: ${MEMORY}MB, CPUs: ${CPUS}"

if [ "$MEMORY" -ge 8192 ]; then
    echo -e "${GREEN}✅ PASS${NC}: CRC memory allocation sufficient (${MEMORY}MB)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: CRC memory might be low (${MEMORY}MB). Recommend 8GB+"
fi

# OpenShift login test
info "Testing OpenShift authentication..."
oc whoami > /dev/null 2>&1
if [ $? -eq 0 ]; then
    USER=$(oc whoami)
    echo -e "${GREEN}✅ PASS${NC}: Logged into OpenShift as $USER"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Not logged into OpenShift. Run: oc login -u developer -p developer"
fi

# Registry login test
info "Testing registry authentication..."
oc registry info > /dev/null 2>&1
test_result "OpenShift registry accessible"

# Test 3: Project Setup
echo ""
echo "🔧 Testing Project Setup..."
echo "---------------------------"

# Check if we're in the IaC directory
if [ -f "Pulumi.yaml" ] && [ -f "index.ts" ] && [ -d "app" ]; then
    echo -e "${GREEN}✅ PASS${NC}: In IaC project directory"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Not in IaC project directory or files missing"
    ((TESTS_FAILED++))
    echo "Please run this script from the IaC project directory"
fi

# npm dependencies
info "Checking npm dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ PASS${NC}: npm dependencies installed"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: npm dependencies not installed. Run: npm install"
fi

# Test 4: Pulumi Setup
echo ""
echo "🔧 Testing Pulumi Setup..."
echo "--------------------------"

# Pulumi login status
info "Checking Pulumi login status..."
pulumi whoami > /dev/null 2>&1
if [ $? -eq 0 ]; then
    USER=$(pulumi whoami)
    echo -e "${GREEN}✅ PASS${NC}: Logged into Pulumi as $USER"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Not logged into Pulumi. Run: pulumi login"
fi

# Test 5: Quick Deployment Test (Optional)
echo ""
echo "🚀 Optional: Quick Deployment Test"
echo "==================================="
read -p "Run a full deployment test? This will create and destroy resources. (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Starting deployment test..."
    
    # Clean any existing test stack
    pulumi stack select test-validation 2>/dev/null || pulumi stack init test-validation
    
    # Set test configuration
    pulumi config set studentNamespace test-validation
    pulumi config set --secret dbPassword TestPassword123
    
    # Test preview
    info "Running pulumi preview..."
    pulumi preview --non-interactive
    test_result "Pulumi preview successful"
    
    # Test deployment
    info "Running pulumi up..."
    timeout 600 pulumi up --yes --non-interactive
    test_result "Pulumi deployment successful"
    
    if [ $? -eq 0 ]; then
        # Test application
        info "Testing application accessibility..."
        APP_URL=$(pulumi stack output appUrl 2>/dev/null || echo "")
        if [ -n "$APP_URL" ]; then
            sleep 10  # Wait for pods to be ready
            curl -f -s "$APP_URL" > /dev/null
            test_result "Application accessible"
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

# Test Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Your environment is ready for the workshop.${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please address the issues above before running the workshop.${NC}"
    exit 1
fi