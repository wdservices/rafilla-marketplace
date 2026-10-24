import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs one notification tick exactly like the /api/notify-tick cron does.
 * Must live inside the project (not temp) so vite-node loads vite.config.ts
 * and web-push / admin SDK module handling matches production.
 *
 *   npx vite-node scripts/run-notify-tick.ts
 */

const envPath = join(process.cwd(), ".env");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (k && !process.env[k]) process.env[k] = t.slice(i + 1);
  }
} catch {
  // no .env — env must already be provided by the shell
}

const { runNotifyTick } = await import("../src/lib/notify-worker");
const origin = (process.env["SITE_ORIGIN"] || "https://raffila.com").trim();

const report = await runNotifyTick({ origin });
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok && report.errors.length === 0 ? 0 : 1);
