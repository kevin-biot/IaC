#!/bin/bash
# external-pulumi-load-test.sh
# Simulates 25 students running Pulumi operations simultaneously

set -e

# Configuration
STUDENT_COUNT=${2:-25}  # Number of students to test
STUDENTS=($(seq -f "student%02g" 1 $STUDENT_COUNT))
OPERATION=${1:-preview}  # preview, up, or destroy
BASE_DIR="/Users/kevinbrown/IaC"
LOG_DIR="${BASE_DIR}/load-test-logs"
PARALLEL_LIMIT=${3:-5}  # Number of parallel operations

echo "🚀 Pulumi Load Test - External Execution"
echo "========================================"
echo "Operation: ${OPERATION}"
echo "Students: ${#STUDENTS[@]}"
echo "Parallel limit: ${PARALLEL_LIMIT}"
echo "Base directory: ${BASE_DIR}"
echo ""

# Create logs directory
mkdir -p "${LOG_DIR}"
rm -f "${LOG_DIR}"/*.log 2>/dev/null || true

# Function to run Pulumi for a single student namespace
run_pulumi_for_student() {
    local student=$1
    local operation=$2
    local log_file="${LOG_DIR}/${student}-${operation}.log"
    
    echo "[$(date '+%H:%M:%S')] Starting ${operation} for ${student}..." | tee -a "${log_file}"
    
    # Create a temporary working directory for this student
    local work_dir="${BASE_DIR}/temp-workspaces/pulumi-${student}"
    rm -rf "${work_dir}" 2>/dev/null || true
    mkdir -p "$(dirname "${work_dir}")"
    
    # Copy files but exclude temp-workspaces and logs to avoid recursion
    rsync -a --exclude='temp-workspaces' --exclude='load-test-logs' "${BASE_DIR}/" "${work_dir}/"
    cd "${work_dir}"
    
    # Install dependencies in the temporary directory
    echo "[$(date '+%H:%M:%S')] Installing dependencies..." >> "${log_file}"
    npm install >> "${log_file}" 2>&1 || echo "npm install failed, trying pulumi install" >> "${log_file}"
    pulumi install >> "${log_file}" 2>&1 || echo "pulumi install failed" >> "${log_file}"
    
    # Set up Pulumi configuration for this student
    export PULUMI_CONFIG_PASSPHRASE=""
    pulumi login --local >> "${log_file}" 2>&1
    
    # Initialize stack if it doesn't exist
    pulumi stack select "${student}" 2>/dev/null || pulumi stack init "${student}" >> "${log_file}" 2>&1
    
    # Configure student-specific settings
    pulumi config set studentNamespace "${student}" >> "${log_file}" 2>&1
    pulumi config set --secret dbPassword "workshop123" >> "${log_file}" 2>&1
    
    # Record start time
    local start_time=$(date +%s)
    echo "[$(date '+%H:%M:%S')] Executing: pulumi ${operation}" >> "${log_file}"
    
    # Run the Pulumi operation
    if [ "${operation}" = "up" ]; then
        gtimeout 600 pulumi up --yes --skip-preview >> "${log_file}" 2>&1
    elif [ "${operation}" = "preview" ]; then
        gtimeout 300 pulumi preview >> "${log_file}" 2>&1
    elif [ "${operation}" = "destroy" ]; then
        gtimeout 600 pulumi destroy --yes >> "${log_file}" 2>&1
    else
        echo "Unknown operation: ${operation}" >> "${log_file}"
        return 1
    fi
    
    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $exit_code -eq 0 ]; then
        echo "[$(date '+%H:%M:%S')] ✅ SUCCESS for ${student} (${duration}s)" | tee -a "${log_file}"
    else
        echo "[$(date '+%H:%M:%S')] ❌ FAILED for ${student} (${duration}s, exit code: ${exit_code})" | tee -a "${log_file}"
    fi
    
    # Cleanup
    rm -rf "${work_dir}" 2>/dev/null || true
    
    return $exit_code
}

# Function to monitor cluster resources
monitor_cluster() {
    local monitor_log="${LOG_DIR}/cluster-monitoring.log"
    echo "Starting cluster monitoring..." > "${monitor_log}"
    
    while true; do
        echo "=== $(date) ===" >> "${monitor_log}"
        echo "Node Resources:" >> "${monitor_log}"
        oc top nodes >> "${monitor_log}" 2>&1 || echo "Failed to get node metrics" >> "${monitor_log}"
        echo "" >> "${monitor_log}"
        
        echo "Pod Resources (student namespaces):" >> "${monitor_log}"
        for student in "${STUDENTS[@]}"; do
            oc top pods -n "${student}" 2>/dev/null | grep -E "(NAME|web|postgres)" >> "${monitor_log}" || true
        done
        echo "" >> "${monitor_log}"
        
        echo "Pending/Failed Pods:" >> "${monitor_log}"
        oc get pods --all-namespaces | grep -E "(Pending|Error|CrashLoopBackOff|ImagePullBackOff)" >> "${monitor_log}" 2>&1 || echo "No problematic pods" >> "${monitor_log}"
        echo "" >> "${monitor_log}"
        
        sleep 30
    done
}

# Start cluster monitoring in background
echo "🔍 Starting cluster monitoring..."
monitor_cluster &
MONITOR_PID=$!

# Trap to cleanup monitoring process
trap "kill $MONITOR_PID 2>/dev/null || true" EXIT

echo "⏰ Test started at: $(date)"
echo ""

# Create array to track background jobs
declare -a pids

# Run Pulumi operations in parallel (with limit)
count=0
for student in "${STUDENTS[@]}"; do
    # Wait if we've reached the parallel limit
    while [ ${#pids[@]} -ge $PARALLEL_LIMIT ]; do
        # Check completed jobs and remove them from array
        for i in "${!pids[@]}"; do
            if ! kill -0 "${pids[$i]}" 2>/dev/null; then
                unset "pids[$i]"
            fi
        done
        # Rebuild array to remove gaps
        pids=("${pids[@]}")
        sleep 1
    done
    
    # Start new job
    run_pulumi_for_student "$student" "$OPERATION" &
    pids+=($!)
    count=$((count + 1))
    echo "📋 Started ${OPERATION} for ${student} (${count}/${#STUDENTS[@]})"
    
    # Small delay to avoid overwhelming the API server
    sleep 2
done

echo ""
echo "⏳ Waiting for all operations to complete..."

# Wait for all background jobs
for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
done

echo ""
echo "✅ Test completed at: $(date)"

# Generate summary report
echo ""
echo "📊 LOAD TEST SUMMARY"
echo "===================="

total_success=0
total_failed=0
total_duration=0

for student in "${STUDENTS[@]}"; do
    log_file="${LOG_DIR}/${student}-${OPERATION}.log"
    if [ -f "$log_file" ]; then
        if grep -q "✅ SUCCESS" "$log_file"; then
            duration=$(grep "SUCCESS" "$log_file" | sed 's/.*(\([0-9]*\)s).*/\1/')
            total_success=$((total_success + 1))
            total_duration=$((total_duration + duration))
            echo "✅ ${student}: ${duration}s"
        else
            total_failed=$((total_failed + 1))
            echo "❌ ${student}: FAILED"
        fi
    else
        total_failed=$((total_failed + 1))
        echo "❌ ${student}: NO LOG FILE"
    fi
done

avg_duration=0
if [ $total_success -gt 0 ]; then
    avg_duration=$((total_duration / total_success))
fi

echo ""
echo "📈 STATISTICS"
echo "============="
echo "Total students: ${#STUDENTS[@]}"
echo "Successful operations: $total_success"
echo "Failed operations: $total_failed"
echo "Success rate: $(( (total_success * 100) / ${#STUDENTS[@]} ))%"
echo "Average duration: ${avg_duration}s"
echo ""
echo "📁 Detailed logs available in: ${LOG_DIR}"
echo "🔍 Cluster monitoring log: ${LOG_DIR}/cluster-monitoring.log"

# Stop monitoring
kill $MONITOR_PID 2>/dev/null || true

# Cleanup temporary workspaces
echo "🧹 Cleaning up temporary workspaces..."
rm -rf "${BASE_DIR}/temp-workspaces" 2>/dev/null || true