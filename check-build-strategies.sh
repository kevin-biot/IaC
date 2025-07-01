#!/bin/bash
# check-build-strategies.sh - Check available build strategies

echo "🔍 Checking available build strategies..."

echo "=== ClusterBuildStrategies ==="
oc get clusterbuildstrategy

echo ""
echo "=== BuildStrategies ==="  
oc get buildstrategy -A

echo ""
echo "=== Shipwright Build CRDs ==="
oc get crd | grep shipwright

echo ""
echo "=== Check for source-to-image ==="
oc get clusterbuildstrategy source-to-image 2>/dev/null && echo "source-to-image available" || echo "source-to-image NOT available"

echo ""
echo "=== Check for buildah ==="
oc get clusterbuildstrategy buildah 2>/dev/null && echo "buildah available" || echo "buildah NOT available"

echo ""
echo "=== Check for kaniko ==="
oc get clusterbuildstrategy kaniko 2>/dev/null && echo "kaniko available" || echo "kaniko NOT available"