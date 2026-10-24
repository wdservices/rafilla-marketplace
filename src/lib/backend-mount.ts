/**
 * Backend mount helpers for the Namecheap split deploy.
 *
 * Production layout (see BUILD-AND-DEPLOY.md):
 *   ~/backend/    -- Node app (this bundle), mounted at https://<domain>/api
 *                    via cPanel "Setup Node.js App" (Application URL path `api`).
 *   public_html/  -- static frontend (this build's .output/public + .htaccess),
 *                    served directly by Apache. Anything that is NOT a real
 *                    file/dir there is rewritten to /api/<original-path>, so
 *                    SSR pages, server functions and /api/* all reach Node.
 *
 * Passenger path ambiguity: depending on host config, the Node app either
 * receives the path WITH the /api mount prefix (e.g. `/api/auth`) or with it
 * stripped (e.g. `/auth`). normalizeBackendMountPath() maps BOTH shapes to
 * the canonical in-app route, so the deploy works either way:
 *   stripped   /auth            -> /auth            (unchanged)
 *   unstripped /api/auth        -> /auth            (prefix removed)
 *   stripped   /health          -> /api/health      (alias: /api/health arrived stripped)
 *   unstripped /api/health      -> /api/health      (allow-listed, kept)
 *   either     /_serverFn/<id>  -> /_serverFn/<id>  (prefix removed when present)
 *
 * SERVER ONLY. This module imports node:fs — never import it from client code.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The production bundle (nitro node-server preset) ships firebase SDKs as ESM
 * chunks whose bundled CJS code references bare `__dirname` (proto-dir
 * computation in the Firestore libs). Plain Node ESM has no such binding, so
 * the first firebase-admin import would throw `ReferenceError: __dirname is
 * not defined` and every server payment/firestore path would fail (dev is
 * unaffected — Vite's SSR transform provides real per-module values, which
 * correctly shadow this fallback). Seed a best-effort global from the app
 * root so those references resolve instead of throwing. Idempotent.
 */
export function ensureNodeGlobals(appDir: string = process.cwd()): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["__dirname"] !== "string") g["__dirname"] = appDir;
  if (typeof g["__filename"] !== "string") g["__filename"] = join(appDir, "server", "index.mjs");
}

/**
 * App-owned routes that genuinely live under /api. Everything else arriving
 * with an /api prefix is a forwarded page/server-fn path that had the mount
 * prefix added by the public_html rewrite (or kept by a non-stripping host).
 * ADD every future /api/* route here or it will be misrouted to pages.
 */
export const BACKEND_API_ROUTES: ReadonlySet<string> = new Set(["/api/health", "/api/notify-tick"]);

export function normalizeBackendMountPath(pathname: string): string {
  // Bare /health can only be a stripped /api/health (no in-app /health route).
  if (pathname === "/health") return "/api/health";
  // Bare mount root behaves like the site root.
  if (pathname === "/api") return "/";
  // Forwarded path seen WITH the mount prefix: remove exactly one level.
  if (pathname.startsWith("/api/") && !BACKEND_API_ROUTES.has(pathname)) {
    return pathname.slice("/api".length);
  }
  return pathname;
}

/**
 * Should this request get the mount-root status document instead of routing?
 * True for the exact mount path (/api, unstripped arrival) and for / with the
 * api-root marker the public_html rewrite adds (stripped arrival). Everything
 * else routes normally — in particular a bare / still serves the homepage.
 */
export function isApiRootRequest(pathname: string, search: string): boolean {
  if (pathname === "/api") return true;
  if (pathname !== "/") return false;
  return new URLSearchParams(search).has("api-root");
}

let cachedPackagedBuildId: string | null | undefined;

/**
 * Build ID stamped into backend/build-info.json at package time (same ID the
 * frontend carries baked in and /api/health surfaces). Cached after first
 * read; null when absent (dev, older deploys). Never throws.
 */
export function getPackagedBuildId(appDir: string = process.cwd()): string | null {
  if (cachedPackagedBuildId !== undefined) return cachedPackagedBuildId;
  try {
    const raw = readFileSync(join(appDir, "build-info.json"), "utf8");
    const parsed = JSON.parse(raw) as { buildId?: unknown };
    cachedPackagedBuildId =
      typeof parsed.buildId === "string" && parsed.buildId ? parsed.buildId : null;
  } catch {
    cachedPackagedBuildId = null;
  }
  return cachedPackagedBuildId;
}

/** Tiny JSON status document for the mount root (GET /api in a browser). */
export function apiRootStatusResponse(): Response {
  return Response.json(
    {
      ok: true,
      service: "rafilla-grand-prizes",
      message: "API running",
      mount: "/api",
      buildId: getPackagedBuildId(),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Return a Request for the same incoming request but a different pathname.
 * Builds the replacement explicitly (method + headers + body stream) because
 * `new Request(url, oldRequest)` does NOT carry method/body across in undici.
 */
export function rewriteRequestPath(request: Request, pathname: string): Request {
  const url = new URL(request.url);
  if (url.pathname === pathname) return request;
  url.pathname = pathname;
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(url, init);
}

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Best-effort `.env` loader for hosts (cPanel) where env vars live in a file
 * next to the app instead of the process environment. Only fills keys that
 * are NOT already set, so real environment variables always win. Never throws.
 *
 * @param envDir directory containing `.env` (defaults to process cwd, which
 *               is the app root under Passenger/cPanel).
 * @returns the keys this call filled (useful for logging, never the values).
 */
export function loadLocalEnvFile(envDir: string = process.cwd()): string[] {
  const filled: string[] = [];
  let text: string;
  try {
    const file = join(envDir, ".env");
    if (!existsSync(file)) return filled;
    text = readFileSync(file, "utf8");
  } catch {
    return filled;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!ENV_KEY_PATTERN.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2) {
      const first = value.charAt(0);
      const last = value.charAt(value.length - 1);
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      filled.push(key);
    }
  }
  return filled;
}
