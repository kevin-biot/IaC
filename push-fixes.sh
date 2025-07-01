#!/bin/bash
# push-fixes.sh - Commit and push the Pulumi RBAC fixes

set -e

echo "🔧 Pushing Pulumi RBAC fixes to GitHub..."

# Change to IaC directory
cd /Users/kevinbrown/IaC

# Check current status
echo "📋 Current git status:"
git status --porcelain

# Check current branch
echo "📍 Current branch: $(git branch --show-current)"

# Add the modified files
echo "➕ Adding modified files..."
git add index.ts validate-fixes.sh

# Show what we're about to commit
echo "📝 Changes to be committed:"
git diff --cached --name-only

# Commit with descriptive message
echo "💾 Committing changes..."
git commit -m "Fix: Resolve Pulumi RBAC dependency issue

- Fix RoleBinding reference to Role using explicit names
- Add explicit resource names for better predictability  
- Improve dependency declarations with dependsOn
- Add validation script for testing fixes
- Enhance URL exports for debugging

Fixes the preview error: 'roles.rbac.authorization.k8s.io not found'
Students can now run 'pulumi preview' successfully."

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Successfully pushed fixes to GitHub!"
echo ""
echo "📚 Students can now update their code with:"
echo "   cd ~/workspace/labs/day1-pulumi"
echo "   git pull origin main"
echo "   pulumi preview  # Should work without RBAC errors"
