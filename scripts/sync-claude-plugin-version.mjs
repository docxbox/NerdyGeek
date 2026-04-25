import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;

const pluginPath = path.join(repoRoot, ".claude-plugin", "plugin.json");
const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");

const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
plugin.version = version;

const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
marketplace.metadata = {
  ...(marketplace.metadata ?? {}),
  version
};
marketplace.plugins = (marketplace.plugins ?? []).map((entry) =>
  entry.name === plugin.name
    ? {
        ...entry,
        version
      }
    : entry
);

fs.writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`, "utf8");
fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");

console.log(`Synced Claude plugin metadata to version ${version}`);
