#!/bin/bash
# cluster-monitor.sh
# Real-time monitoring during load tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display header
show_header() {
    clear
    echo -e "${BLUE}🔍 CLUSTER LOAD TEST MONITOR${NC}"
    echo -e "${BLUE}============================${NC}"
    echo "Time: $(date)"
    echo ""
}

# Function to show node resources
show_node_resources() {
    echo -e "${GREEN}📊 NODE RESOURCES${NC}"
    echo "----------------"
    oc adm top nodes 2>/dev/null || echo -e "${RED}❌ Failed to get node metrics${NC}"
    echo ""
}

# Function to show student pod status
show_student_pods() {
    echo -e "${GREEN}🏫 STUDENT POD STATUS${NC}"
    echo "--------------------"
    
    local running=0
    local pending=0
    local failed=0
    
    for i in {01..25}; do
        local student="student${i}"
        local status=$(oc get pods -n "$student" --no-headers 2>/dev/null | awk '{print $3}' | head -1)
        
        case $status in
            "Running") running=$((running + 1)) ;;
            "Pending") pending=$((pending + 1)) ;;
            "Error"|"CrashLoopBackOff"|"ImagePullBackOff") failed=$((failed + 1)) ;;
        esac
    done
    
    echo -e "Running: ${GREEN}$running${NC} | Pending: ${YELLOW}$pending${NC} | Failed: ${RED}$failed${NC}"
    echo ""
}

# Function to show resource intensive pods
show_top_pods() {
    echo -e "${GREEN}🔥 TOP RESOURCE CONSUMERS${NC}"
    echo "------------------------"
    
    # Get top CPU consumers
    echo "Top CPU:"
    oc adm top pods --all-namespaces --sort-by=cpu 2>/dev/null | head -6 | grep -E "(NAMESPACE|student)" || echo "No data available"
    echo ""
    
    # Get top Memory consumers
    echo "Top Memory:"
    oc adm top pods --all-namespaces --sort-by=memory 2>/dev/null | head -6 | grep -E "(NAMESPACE|student)" || echo "No data available"
    echo ""
}

# Function to show cluster events
show_recent_events() {
    echo -e "${GREEN}⚠️ RECENT EVENTS${NC}"
    echo "---------------"
    oc get events --all-namespaces --sort-by='.lastTimestamp' 2>/dev/null | tail -5 | grep -E "(Warning|Error)" || echo "No recent warnings/errors"
    echo ""
}

# Function to show API server health
show_api_health() {
    echo -e "${GREEN}🌐 API SERVER HEALTH${NC}"
    echo "------------------"
    
    # Test API responsiveness
    local start_time=$(date +%s)
    oc get namespaces >/dev/null 2>&1
    local end_time=$(date +%s)
    local api_latency=$(((end_time - start_time) * 1000))
    
    if [ $api_latency -lt 1000 ]; then
        echo -e "API Response Time: ${GREEN}${api_latency}ms${NC}"
    elif [ $api_latency -lt 5000 ]; then
        echo -e "API Response Time: ${YELLOW}${api_latency}ms${NC}"
    else
        echo -e "API Response Time: ${RED}${api_latency}ms${NC}"
    fi
    echo ""
}

# Function to show deployment progress
show_deployment_progress() {
    echo -e "${GREEN}🚀 DEPLOYMENT PROGRESS${NC}"
    echo "---------------------"
    
    local total_deployments=0
    local ready_deployments=0
    
    for i in {01..25}; do
        local student="student${i}"
        local web_status=$(oc get deployment web -n "$student" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local postgres_status=$(oc get deployment postgres -n "$student" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        
        total_deployments=$((total_deployments + 2))
        
        if [ "$web_status" = "1" ]; then
            ready_deployments=$((ready_deployments + 1))
        fi
        
        if [ "$postgres_status" = "1" ]; then
            ready_deployments=$((ready_deployments + 1))
        fi
    done
    
    local progress_percent=$((ready_deployments * 100 / total_deployments))
    echo "Ready Deployments: $ready_deployments/$total_deployments ($progress_percent%)"
    
    # Progress bar
    local bar_length=30
    local filled_length=$((progress_percent * bar_length / 100))
    local bar=""
    
    for ((i=0; i<filled_length; i++)); do
        bar="${bar}█"
    done
    
    for ((i=filled_length; i<bar_length; i++)); do
        bar="${bar}░"
    done
    
    echo -e "[${GREEN}${bar}${NC}] ${progress_percent}%"
    echo ""
}

# Main monitoring loop
echo "Starting cluster monitoring for load test..."
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    show_header
    show_node_resources
    show_student_pods
    show_top_pods
    show_recent_events
    show_api_health
    show_deployment_progress
    
    echo -e "${BLUE}Next update in 10 seconds...${NC}"
    sleep 10
done