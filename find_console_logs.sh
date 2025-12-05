#!/bin/bash
# Quick script to identify all console logs that need replacement

echo "=== Finding all console logs in app ===="
echo ""

grep -r "console\." app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | head -30

echo ""
echo "=== Files needing logger import and console replacement ===="
grep -r "console\." app/ --include="*.tsx" --include="*.ts" -l | grep -v node_modules | sort | uniq

echo ""
echo "=== Total console logs to replace ===" 
grep -r "console\." app/ --include="*.tsx" --include="*.ts" | grep -v node_modules | wc -l

echo ""
echo "Quick replacement guide:"
echo "1. Add: import { logger } from '../../src/utils/logger';"
echo "2. Replace: console.log()   → logger.log()"
echo "3. Replace: console.error() → logger.error()"
echo "4. Replace: console.warn()  → logger.warn()"
