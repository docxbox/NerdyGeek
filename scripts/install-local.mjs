import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const agent = process.argv[2];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const windowsRepoRoot = repoRoot.replace(/\//g, "\\");

function ensureBuilt() {
  const stdioPath = path.join(repoRoot, "dist", "src", "stdio.js");
  const httpPath = path.join(repoRoot, "dist", "src", "httpServer.js");

  if (!fs.existsSync(stdioPath) || !fs.existsSync(httpPath)) {
    throw new Error("Build output is missing. Run `npm install && npm run build` first.");
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function installClaudeCode() {
  ensureBuilt();
  const filePath = path.join(repoRoot, ".mcp.json");
  writeJson(filePath, {
    mcpServers: {
      nerdygeek: {
        command: "node",
        args: ["dist/src/stdio.js"],
        env: {}
      }
    }
  });

  console.log(`Claude Code local config written to ${filePath}`);
  console.log("Next step: open this repo in Claude Code.");
}

function installCodex() {
  ensureBuilt();
  const codexDir = path.join(os.homedir(), ".codex");
  const configPath = path.join(codexDir, "config.toml");
  const block = `\n[mcp_servers.nerdygeek]\nurl = "http://127.0.0.1:3000/mcp"\n`;

  fs.mkdirSync(codexDir, { recursive: true });

  const current = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const next = current.includes("[mcp_servers.nerdygeek]")
    ? current.replace(/\[mcp_servers\.nerdygeek\][\s\S]*?(?=\n\[|$)/, `[mcp_servers.nerdygeek]\nurl = "http://127.0.0.1:3000/mcp"\n`)
    : `${current.trimEnd()}${block}`;

  fs.writeFileSync(configPath, `${next.trimEnd()}\n`, "utf8");

  const launcherPath = path.join(repoRoot, "scripts", "start-codex-local.ps1");
  const launcher = [
    "$ErrorActionPreference = 'Stop'",
    `$projectRoot = '${windowsRepoRoot}'`,
    "Set-Location $projectRoot",
    "npm run build | Out-Host",
    "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess",
    "if ($listener) { Stop-Process -Id $listener -Force -ErrorAction SilentlyContinue }",
    "$p = Start-Process -FilePath node -ArgumentList 'dist/src/httpServer.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru",
    "Start-Sleep -Seconds 2",
    "Write-Output \"NerdyGeek local MCP started on http://127.0.0.1:3000/mcp (PID=$($p.Id))\""
  ].join("\r\n");

  fs.writeFileSync(launcherPath, `${launcher}\r\n`, "utf8");

  console.log(`Codex config updated at ${configPath}`);
  console.log(`Start NerdyGeek locally with: powershell -ExecutionPolicy Bypass -File "${launcherPath}"`);
}

switch (agent) {
  case "claude-code":
    installClaudeCode();
    break;
  case "codex":
    installCodex();
    break;
  case "all":
    installClaudeCode();
    installCodex();
    break;
  default:
    console.error("Usage: node scripts/install-local.mjs <claude-code|codex|all>");
    process.exit(1);
}
