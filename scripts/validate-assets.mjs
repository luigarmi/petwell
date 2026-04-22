import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

async function main() {
  const dashboardDir = path.join(rootDir, 'infra', 'grafana', 'dashboards');
  const entries = await readdir(dashboardDir, { withFileTypes: true });
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  if (jsonFiles.length === 0) {
    throw new Error(`No Grafana dashboards found in ${dashboardDir}`);
  }

  for (const file of jsonFiles) {
    const fullPath = path.join(dashboardDir, file.name);
    const content = await readFile(fullPath, 'utf8');
    JSON.parse(content);
    process.stdout.write(`[petwell-assets] dashboard ok: ${file.name}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
