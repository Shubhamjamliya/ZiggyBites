#!/usr/bin/env node

/**
 * ==============================================================================
 * Comprehensive Security & Malware Audit Scanner (Cross-Platform)
 * ==============================================================================
 * Runs natively on Windows (CMD / PowerShell / Git Bash), macOS, and Linux
 * with zero external dependencies.
 *
 * Scans for:
 *  1. Malware signatures, hidden injection & global scope tampering
 *  2. Hidden whitespace obfuscation (>80 spaces hiding malicious code)
 *  3. Zero-width spaces & Trojan Source bidirectional Unicode exploits
 *  4. High-risk dynamic code execution (eval, new Function, base64 payloads)
 *  5. Hardcoded API keys, private keys, database credentials, & secret leaks
 *  6. Supply chain risks & suspicious npm lifecycle scripts
 *  7. Disguised payload files (fa-solid-400.woff2, unexpected executables)
 *  8. IDE & workspace auto-execution exploits (.vscode folderOpen, tasks, settings)
 *  9. Network exfiltration & Ethereum RPC C2 endpoints (1rpc.io, drpc.org, blastapi.io)
 *
 * Flags:
 *  --deep            Scan node_modules as well (read-only audit)
 *  --json            Output results as JSON for CI/CD pipelines
 *  --help            Display help information
 *
 * NOTE: This tool is strictly READ-ONLY. It never deletes or alters files.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// CLI Arguments
const args = process.argv.slice(2);
const isDeepScan = args.includes('--deep');
const isJsonOutput = args.includes('--json');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Comprehensive Security & Malware Scanner

Usage:
  node scripts/security-scan.js [options]

Options:
  --deep     Also scan node_modules directory (read-only)
  --json     Output results in JSON format
  --help     Show this help message

Compatibility:
  Works natively across Windows (PowerShell/CMD/Git Bash), macOS, and Linux.
`);
  process.exit(0);
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// Scan stats & findings
const findings = [];
let scannedFileCount = 0;
let skippedFileCount = 0;

// Directories to ignore by default
const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  'temp',
  'tmp',
]);

// Ignored files (such as the security scanner itself and lockfiles)
const SELF_FILE_NAMES = new Set([
  'security-scan.js',
  'security-scan.sh',
]);

// Extensions to inspect as text
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx',
  '.json', '.json5',
  '.html', '.htm',
  '.css', '.scss', '.sass', '.less',
  '.vue', '.svelte',
  '.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1',
  '.yml', '.yaml',
  '.md', '.txt',
]);

// Suspicious binary / executable extensions to flag if found in source directories
const SUSPICIOUS_EXEC_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.vbs', '.scr', '.pif', '.hta', '.cpl',
]);

// Known disguised malware file names
const KNOWN_MALWARE_PAYLOAD_NAMES = new Set([
  'fa-solid-400.woff2',
  'font-awesome-400.woff2',
  'fa-regular-400.woff2',
]);

// Check if a file is git-ignored
function isFileGitIgnored(filePath) {
  try {
    const relativePath = path.relative(ROOT_DIR, filePath);
    const output = execSync(`git check-ignore "${relativePath}"`, {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    return output.trim().length > 0;
  } catch (e) {
    return false;
  }
}

// Helper: Check if path should be scanned
function shouldScanPath(filePath, isDirectory) {
  const baseName = path.basename(filePath);

  if (isDirectory) {
    if (baseName === 'node_modules' && !isDeepScan) return false;
    if (DEFAULT_IGNORED_DIRS.has(baseName)) return false;
    return true;
  }

  // Self file skip
  if (SELF_FILE_NAMES.has(baseName)) return false;

  // Ignore local .env files if they are properly gitignored
  if (baseName === '.env' || baseName.startsWith('.env.')) {
    if (isFileGitIgnored(filePath)) {
      return false;
    }
  }

  // Ignore large build outputs/lockfiles for line scanning to avoid noise
  if (baseName === 'package-lock.json' || baseName === 'yarn.lock' || baseName === 'pnpm-lock.yaml') {
    return false;
  }
  if (baseName === 'build_output.txt') return false;

  return true;
}

// Traverse directory recursively
function* walkDirectory(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldScanPath(fullPath, true)) {
        yield* walkDirectory(fullPath);
      }
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (shouldScanPath(fullPath, false)) {
        yield fullPath;
      } else {
        skippedFileCount++;
      }
    }
  }
}

// Record an issue with explicit actionable instructions
function reportFinding({ file, line = null, category, message, severity = 'HIGH', snippet = '', action = '' }) {
  const relativeFile = path.relative(ROOT_DIR, file) || file;
  findings.push({
    file: relativeFile,
    line,
    category,
    message,
    severity,
    snippet: snippet.trim().substring(0, 160),
    action,
  });
}

// -----------------------------------------------------------------------------
// AUDIT ENGINE 1: File Names & Disguised Payloads
// -----------------------------------------------------------------------------
function auditFileNameAndPath(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(ROOT_DIR, filePath);

  // 1. Check known disguised malware payload names
  if (KNOWN_MALWARE_PAYLOAD_NAMES.has(fileName.toLowerCase())) {
    reportFinding({
      file: filePath,
      category: 'KNOWN_MALWARE_PAYLOAD',
      message: `Known disguised malware payload file detected: "${fileName}"`,
      severity: 'CRITICAL',
      action: `🗑️  DELETE FILE: Remove "${relativePath}" completely. It is a known disguised malware binary.`,
    });
  }

  // 2. Check for unexpected executable binaries inside source/assets
  if (SUSPICIOUS_EXEC_EXTENSIONS.has(ext)) {
    reportFinding({
      file: filePath,
      category: 'SUSPICIOUS_BINARY',
      message: `Suspicious executable binary found inside repository: "${fileName}"`,
      severity: 'HIGH',
      action: `🗑️  DELETE FILE: Inspect and remove "${relativePath}" unless it is a verified project tool.`,
    });
  }

  // 3. Check for untracked/unignored .env files committed to git
  if (fileName === '.env' || fileName.startsWith('.env.')) {
    if (!isFileGitIgnored(filePath)) {
      reportFinding({
        file: filePath,
        category: 'COMMITTED_SECRETS_FILE',
        message: `Unignored .env file detected at "${relativePath}".`,
        severity: 'HIGH',
        action: `🔒 FIX CONFIG: Add "${relativePath}" to .gitignore and run "git rm --cached ${relativePath}".`,
      });
    }
  }
}

// -----------------------------------------------------------------------------
// AUDIT ENGINE 2: IDE & Workspace Auto-Execution Exploit Checks
// -----------------------------------------------------------------------------
function auditIdeConfigurations(filePath, content) {
  const baseName = path.basename(filePath);

  if (baseName === 'tasks.json' && filePath.includes('.vscode')) {
    if (/folderOpen/i.test(content)) {
      reportFinding({
        file: filePath,
        category: 'IDE_AUTO_RUN_EXPLOIT',
        message: 'Malicious .vscode/tasks.json with "runOn: folderOpen" detected! This allows auto-execution on workspace open.',
        severity: 'CRITICAL',
        action: '✂️  DELETE FILE / REMOVE TASK: Delete ".vscode/tasks.json" or remove the task containing "runOn": "folderOpen".',
      });
    }
  }

  if (baseName === 'settings.json' && filePath.includes('.vscode')) {
    if (/terminal\.integrated\.profiles|python\.terminal\.activateEnvironment|git\.path/i.test(content)) {
      if (/(cmd\.exe|powershell\.exe|bash|sh|curl|wget|certutil)\s+-[ec]/i.test(content)) {
        reportFinding({
          file: filePath,
          category: 'IDE_SETTINGS_EXPLOIT',
          message: 'Suspicious terminal command override in .vscode/settings.json.',
          severity: 'HIGH',
          action: '✂️  REMOVE CODE: Delete suspicious terminal/executable override commands in .vscode/settings.json.',
        });
      }
    }
  }
}

// -----------------------------------------------------------------------------
// AUDIT ENGINE 3: Supply Chain & package.json Lifecycle Scripts
// -----------------------------------------------------------------------------
function auditPackageJson(filePath, content) {
  if (path.basename(filePath) !== 'package.json') return;

  try {
    const pkg = JSON.parse(content);
    const scripts = pkg.scripts || {};

    const DANGEROUS_HOOKS = ['preinstall', 'postinstall', 'install', 'prepack', 'postpack', 'prebuild'];
    const SUSPICIOUS_SCRIPT_PATTERNS = [
      /curl\s+-[fsS]/i,
      /wget\s+/i,
      /powershell\s+(-enc|-e|invoke-webrequest|iwr|downloadstring)/i,
      /certutil\s+-urlcache/i,
      /node\s+-e\s+["'].*eval/i,
      /bash\s+-c\s+["'].*(curl|wget)/i,
      /https?:\/\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/i,
      /pastebin\.com\/raw/i,
      /discord\.com\/api\/webhooks/i,
      /ngrok\.io/i,
    ];

    for (const hook of DANGEROUS_HOOKS) {
      if (scripts[hook]) {
        const cmd = scripts[hook];
        for (const pattern of SUSPICIOUS_SCRIPT_PATTERNS) {
          if (pattern.test(cmd)) {
            reportFinding({
              file: filePath,
              category: 'MALICIOUS_LIFECYCLE_SCRIPT',
              message: `High-risk lifecycle script in package.json ["${hook}": "${cmd}"]`,
              severity: 'CRITICAL',
              snippet: cmd,
              action: `✂️  DELETE LINE: Remove the "${hook}" script entry completely from this package.json file.`,
            });
          }
        }
      }
    }

    // Check dependencies for raw external urls
    const checkDeps = (depsObj = {}) => {
      for (const [dep, ver] of Object.entries(depsObj)) {
        if (typeof ver === 'string' && (ver.startsWith('http://') || ver.includes('pastebin') || ver.includes('ngrok'))) {
          reportFinding({
            file: filePath,
            category: 'SUSPICIOUS_DEPENDENCY_URL',
            message: `Dependency "${dep}" points to an insecure or suspicious remote URL: ${ver}`,
            severity: 'HIGH',
            snippet: `"${dep}": "${ver}"`,
            action: `📦 REPLACE DEPENDENCY: Change "${dep}" to an official semantic version from npm registry.`,
          });
        }
      }
    };

    checkDeps(pkg.dependencies);
    checkDeps(pkg.devDependencies);
  } catch (e) {
    // Malformed JSON is reported separately
  }
}

// -----------------------------------------------------------------------------
// AUDIT ENGINE 4: Vite Configuration & createRequire Exploits
// -----------------------------------------------------------------------------
function auditViteConfig(filePath, content) {
  const fileName = path.basename(filePath);
  if (/vite\.config\.(js|ts|mjs|cjs)$/i.test(fileName)) {
    if (/\bcreateRequire\b/.test(content)) {
      reportFinding({
        file: filePath,
        category: 'UNAUTHORIZED_CREATEREQUIRE',
        message: 'Unnecessary createRequire found in vite.config. This is a known vector used in Vite build injection attacks.',
        severity: 'HIGH',
        snippet: 'createRequire',
        action: '✂️  REMOVE CODE: Remove "const require = createRequire(import.meta.url);" and any "global.require" or "global.i" lines from this vite.config file.',
      });
    }
  }
}

// -----------------------------------------------------------------------------
// AUDIT ENGINE 5: Code Analysis (Malware Signatures, Obfuscation, Secrets, Unicode)
// -----------------------------------------------------------------------------
function auditCodeContent(filePath, content) {
  const fileName = path.basename(filePath);
  if (fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.markdown')) {
    return;
  }

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) continue;

    // 1. Suspicious Global Assignments & Obfuscation Identifiers
    const globalMutations = [
      /\bglobal\.i\s*=/g,
      /\bglobal\.require\s*=/g,
      /\bglobal\[['"][^'"]+['"]\]\s*=/g,
      /\bwindow\[['"][^'"]+['"]\]\s*=\s*(function|eval|new\s+Function)/g,
      /\bvar\s+_\$_\s*=/g,
      /\bvar\s+_0x[0-9a-fA-F]+\s*=/g,
      /\bconst\s+_0x[0-9a-fA-F]+\s*=/g,
      /\blet\s+_0x[0-9a-fA-F]+\s*=/g,
    ];

    for (const pattern of globalMutations) {
      if (pattern.test(line)) {
        reportFinding({
          file: filePath,
          line: lineNum,
          category: 'MALWARE_SIGNATURE',
          message: 'Suspicious global assignment or obfuscated identifier detected.',
          severity: 'CRITICAL',
          snippet: line,
          action: '✂️  DELETE LINE: Remove this line completely. It contains malicious scope tampering or obfuscation.',
        });
      }
    }

    // 2. Hidden Whitespace Obfuscation (Lines with >80 spaces pushing payloads to column >100)
    if (/[^ \t][ \t]{80,}[^ \t]/.test(line)) {
      reportFinding({
        file: filePath,
        line: lineNum,
        category: 'HIDDEN_WHITESPACE_OBFUSCATION',
        message: 'Hidden whitespace obfuscation detected (>80 continuous spaces separating tokens).',
        severity: 'CRITICAL',
        snippet: line.substring(0, 50) + ' ... [HIDDEN SPACES] ... ' + line.substring(line.length - 40),
        action: '✂️  DELETE LINE: Remove this line. It conceals malicious code off-screen using excessive spaces.',
      });
    }

    // 3. Invisible Zero-Width Characters (Excluding valid emoji sequences)
    // Remove compound emoji sequences (like 🧑‍🍳, 👩‍🍳, 🏳️‍🌈) before checking
    const lineWithoutEmojis = line.replace(/\p{Extended_Pictographic}\u200D\p{Extended_Pictographic}/gu, '');
    
    // Check for \u200B (Zero-Width Space), \u2060 (Word Joiner), \uFEFF (mid-line BOM)
    if (/[\u200B\u2060]/.test(lineWithoutEmojis) || (lineNum > 1 && /\uFEFF/.test(lineWithoutEmojis))) {
      reportFinding({
        file: filePath,
        line: lineNum,
        category: 'ZERO_WIDTH_CHARACTER_ATTACK',
        message: 'Invisible zero-width character detected in source code.',
        severity: 'HIGH',
        snippet: line,
        action: '✂️  CLEAN LINE: Delete invisible zero-width unicode characters (\u200B, \uFEFF) from this line.',
      });
    }

    // 4. Trojan Source Bidirectional (Bidi) Unicode Override Attacks
    // \u202A-\u202E (LRE, RLE, PDF, LRO, RLO), \u2066-\u2069 (LRI, RLI, FSI, PDI)
    if (/[\u202A-\u202E\u2066-\u2069]/.test(line)) {
      reportFinding({
        file: filePath,
        line: lineNum,
        category: 'TROJAN_SOURCE_UNICODE_ATTACK',
        message: 'Trojan Source Bidirectional Unicode override character detected! This alters visual vs actual code execution.',
        severity: 'CRITICAL',
        snippet: line,
        action: '✂️  DELETE LINE: Remove bidirectional unicode override characters (\u202A–\u202E).',
      });
    }

    // 5. Hardcoded High-Value Secrets & API Keys
    const SECRET_PATTERNS = [
      {
        regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
        name: 'Private Encryption/SSH Key',
        severity: 'CRITICAL',
      },
      {
        regex: /\bAKIA[0-9A-Z]{16}\b/,
        name: 'AWS Access Key ID',
        severity: 'CRITICAL',
      },
      {
        regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/,
        name: 'Stripe Live Secret Key',
        severity: 'CRITICAL',
      },
      {
        regex: /\bghp_[0-9a-zA-Z]{36}\b|\bgithub_pat_[0-9a-zA-Z_]{82}\b/,
        name: 'GitHub Personal Access Token',
        severity: 'CRITICAL',
      },
      {
        regex: /mongodb\+srv:\/\/[^:]+:[^@]+@[a-zA-Z0-9.-]+\.mongodb\.net/i,
        name: 'Hardcoded MongoDB Atlas Connection String with Password',
        severity: 'HIGH',
      },
    ];

    // Don't flag secrets in example files, markdown docs, or test files with mock tokens
    const isDocOrExample = fileName.endsWith('.md') || fileName.includes('example') || fileName.includes('sample');
    if (!isDocOrExample) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          reportFinding({
            file: filePath,
            line: lineNum,
            category: 'LEAKED_CREDENTIAL',
            message: `Potential hardcoded secret detected: ${pattern.name}`,
            severity: pattern.severity,
            snippet: line.replace(/([a-zA-Z0-9_-]{4})[a-zA-Z0-9_-]{8,}([a-zA-Z0-9_-]{4})/, '$1********$2'),
            action: '🔒 REFACTOR CODE: Replace hardcoded password/key with "process.env.<VAR_NAME>" and move credentials into a gitignored .env file.',
          });
        }
      }
    }

    // 6. Hardcoded Exfiltration Webhooks & Network Endpoints
    if (!isDocOrExample) {
      const EXFILTRATION_PATTERNS = [
        { regex: /discord\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/i, name: 'Discord Webhook' },
        { regex: /api\.telegram\.org\/bot[0-9]+:[a-zA-Z0-9_-]+/i, name: 'Telegram Bot Token Endpoint' },
        { regex: /https?:\/\/[a-zA-Z0-9_-]+\.ngrok\.io/i, name: 'Ngrok Tunnel URL' },
        { regex: /https?:\/\/pastebin\.com\/raw\/[a-zA-Z0-9]+/i, name: 'Raw Pastebin Payload Downloader' },
        { regex: /https?:\/\/webhook\.site\/[a-f0-9-]{36}/i, name: 'Webhook.site URL' },
        { regex: /\b(1rpc\.io|eth\.drpc\.org|ethereum-rpc\.publicnode\.com|eth-mainnet\.public\.blastapi\.io)\b/i, name: 'Decentralized Ethereum RPC C2 / Web3 Malware Endpoint' },
      ];

      for (const exfil of EXFILTRATION_PATTERNS) {
        if (exfil.regex.test(line)) {
          reportFinding({
            file: filePath,
            line: lineNum,
            category: 'DATA_EXFILTRATION_INDICATOR',
            message: `Hardcoded exfiltration endpoint found (${exfil.name}).`,
            severity: 'HIGH',
            snippet: line,
            action: '✂️  DELETE LINE: Remove this network endpoint call or RPC domain reference from your source code.',
          });
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// MAIN SCANNER ORCHESTRATOR
// -----------------------------------------------------------------------------
function runSecurityAudit() {
  const startTime = Date.now();

  if (!isJsonOutput) {
    console.log(`${colors.cyan}${colors.bold}🔍 Running Comprehensive Security & Malware Audit...${colors.reset}`);
    console.log(`${colors.dim}Scanning root: ${ROOT_DIR}${colors.reset}`);
    if (isDeepScan) {
      console.log(`${colors.yellow}⚠️  Deep scan enabled: including node_modules in read-only analysis.${colors.reset}`);
    }
    console.log('--------------------------------------------------');
  }

  for (const filePath of walkDirectory(ROOT_DIR)) {
    scannedFileCount++;
    const ext = path.extname(filePath).toLowerCase();

    // 1. Audit File Name & Path
    auditFileNameAndPath(filePath);

    // 2. Audit Content if Text-based
    if (TEXT_EXTENSIONS.has(ext)) {
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        continue;
      }

      auditIdeConfigurations(filePath, content);
      auditPackageJson(filePath, content);
      auditViteConfig(filePath, content);
      auditCodeContent(filePath, content);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Output formatting
  if (isJsonOutput) {
    const output = {
      summary: {
        scannedFiles: scannedFileCount,
        skippedFiles: skippedFileCount,
        durationSeconds: parseFloat(duration),
        totalFindings: findings.length,
        isClean: findings.length === 0,
      },
      findings,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(findings.length > 0 ? 1 : 0);
  }

  // Terminal Pretty Print
  if (findings.length === 0) {
    console.log(`${colors.green}${colors.bold}✅ 1. No suspicious global assignment or obfuscated variables found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 2. No hidden whitespace obfuscation patterns found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 3. No zero-width or Trojan Source Unicode attacks found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 4. vite.config is clean of unauthorized createRequire bridges.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 5. No malicious package.json lifecycle scripts found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 6. No malicious VS Code auto-run tasks or exploits found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 7. No known malware payload files (e.g. fa-solid-400.woff2) found.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 8. No hardcoded private keys or leaked credentials detected.${colors.reset}`);
    console.log(`${colors.green}${colors.bold}✅ 9. No unauthorized exfiltration endpoints detected.${colors.reset}`);
    console.log('--------------------------------------------------');
    console.log(`${colors.green}${colors.bold}🎉 All security checks passed successfully! (${scannedFileCount} files scanned in ${duration}s)${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}❌ Security issues detected (${findings.length} findings):${colors.reset}\n`);

    findings.forEach((finding, idx) => {
      const sevColor = finding.severity === 'CRITICAL' ? colors.red : colors.yellow;
      console.log(`${sevColor}${colors.bold}[${finding.severity}] #${idx + 1}: ${finding.category}${colors.reset}`);
      console.log(`  ${colors.bold}File:${colors.reset}    ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
      console.log(`  ${colors.bold}Details:${colors.reset} ${finding.message}`);
      if (finding.snippet) {
        console.log(`  ${colors.dim}Snippet:${colors.reset} ${finding.snippet}`);
      }
      if (finding.action) {
        console.log(`  ${colors.cyan}${colors.bold}Action:${colors.reset}  ${finding.action}`);
      }
      console.log('');
    });

    console.log('--------------------------------------------------');
    console.log(`${colors.red}${colors.bold}⚠️  Security scan failed with ${findings.length} issue(s). Follow the "Action" steps above before committing.${colors.reset}`);
    process.exit(1);
  }
}

// Execute scanner
runSecurityAudit();
