#!/bin/bash
# ==============================================================================
# Security Scan Script for Malware & Hidden Injection Signatures
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "🔍 Running Malware & Security Audit..."

# 1. Check for suspicious global assignments & obfuscation signatures
if git grep -nIE 'global\.i[[:space:]]*=|global\.require[[:space:]]*=|global\[.+\][[:space:]]*=|var[[:space:]]+_\$_' -- 2>/dev/null | grep -v 'scripts/security-scan.sh' ; then
    echo -e "${RED}❌ Suspicious global assignment or obfuscated variable found!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No suspicious global assignment signatures found.${NC}"
fi

# 2. Check for hidden whitespace obfuscation (>80 spaces between non-whitespace tokens)
if git grep -nIE '[^[:space:]][[:space:]]{80,}[^[:space:]]' -- 2>/dev/null | grep -v 'scripts/security-scan.sh' ; then
    echo -e "${RED}❌ Hidden whitespace obfuscation pattern detected!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No hidden whitespace patterns found.${NC}"
fi

# 3. Check for unauthorized createRequire imports in Vite config files
if git grep -nIE 'createRequire' -- '*vite.config.*' 2>/dev/null ; then
    echo -e "${RED}❌ Unnecessary createRequire found in vite.config! This is a known malware vector in ESM Vite setups.${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ vite.config is clean of createRequire bridge.${NC}"
fi

# 4. Check for malicious VS Code tasks configured to run on folder open
TASKS=$(find . -name 'tasks.json' -not -path '*/node_modules/*' 2>/dev/null || true)
if [ -n "$TASKS" ] && grep -q 'folderOpen' $TASKS 2>/dev/null; then
    echo -e "${RED}❌ Suspicious .vscode/tasks.json with runOn: folderOpen found!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No malicious VS Code auto-run tasks found.${NC}"
fi

# 5. Check for known malware payload files
PAYLOADS=$(find . -name 'fa-solid-400.woff2' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null || true)
if [ -n "$PAYLOADS" ]; then
    echo -e "${RED}❌ Known malicious payload file (fa-solid-400.woff2) found!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No payload files found.${NC}"
fi

echo "--------------------------------------------------"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}⚠️  Security scan failed with $ERRORS issue(s). Please clean before committing.${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 All security checks passed successfully!${NC}"
    exit 0
fi
