#!/bin/bash
# ==============================================================================
# Comprehensive Security & Malware Audit Wrapper
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v node >/dev/null 2>&1; then
    exec node "$SCRIPT_DIR/security-scan.js" "$@"
else
    echo "❌ Node.js is required to execute the security scanner."
    exit 1
fi
