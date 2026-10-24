// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public, auth-free routes to prerender to <route>/index.html at build time.
// NOTE: TanStack auto-collects every static route as a prerender candidate, so
// the filter below is what actually contains the pass to this list. Auth-gated
// (admin/*, dashboard/*, partner/*) and dynamic (competitions/$slug,
// draw-verification/*) routes stay SSR-only.
const PRERENDER_PATHS = [
  "/",
  "/competitions",
  "/winners",
  "/about",
  "/how-it-works",
  "/faq",
  "/contact",
  "/competition-rules",
  "/terms-and-conditions",
  "/privacy-policy",
  "/trust-safety",
  "/become-a-partner",
];

export default defineConfig({
  vite: {
    // firebase-admin is Node-only (grpc, node:http). Client components import
    // modules that reach the Admin SDK through a server-side dynamic import, so
    // Vite's dev dependency crawler would otherwise pre-bundle a ~7MB Node
    // bundle for the browser and break client hydration. Excluding it from the
    // client optimizer fixes dev. It is deliberately NOT marked ssr.external:
    // the production server bundle must stay self-contained (the cPanel zip
    // ships no node_modules).
    optimizeDeps: {
      exclude: ["firebase-admin", "firebase-admin/app", "firebase-admin/firestore"],
    },
    // Firebase client SDK is ~560KB (firestore alone ~470KB). Without splitting
    // it lands in the monolithic main chunk that must be parsed before the
    // page becomes interactive; as separate vendor chunks the browser caches
    // them independently across deploys.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Windows ids use backslashes — normalize before matching.
            const norm = id.replace(/\\/g, "/");
            if (norm.includes("node_modules")) {
              if (norm.includes("@firebase/firestore")) return "vendor-firestore";
              if (norm.includes("@firebase/") || norm.includes("/firebase/"))
                return "vendor-firebase";
            }
            return undefined;
          },
        },
      },
    },
    // The release pipeline (scripts/build-namecheap.ps1) writes then deletes
    // .output/ and drops zips into deploy/ while `npm run dev` may be running.
    // Vite's watcher was crashing on those directories with
    // "UNKNOWN: unknown error, lstat '.output\public\assets'" and taking the
    // dev server down. Keep build artifacts out of the watched set.
    server: {
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.output/**",
          "**/.output",
          "**/dist",
          "**/dist/**",
          "**/deploy/**",
          "**/.tanstack-start/**",
          "**/coverage/**",
          "**/*.zip",
        ],
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static prerendering is performed AFTER the build by
    // scripts/prerender-namecheap.mjs, which boots the freshly built nitro
    // node-server and crawls these routes (deterministic: real production
    // bundle, real asset URLs, VITE_BUILD_ID baked into the HTML).
    // The plugin's own prerender flow MUST stay disabled: its preview shim
    // imports nitro's node-server entry, whose default export has no .fetch
    // (and importing it starts a rogue listener that hangs the build), so
    // every route 500s and zero pages are emitted.
    prerender: {
      enabled: false,
      crawlLinks: false,
      autoSubfolderIndex: true,
      filter: (page: { path: string }) => {
        const p = page.path.replace(/\/+$/, "") || "/";
        return PRERENDER_PATHS.includes(p);
      },
    },
    pages: PRERENDER_PATHS.map((path) => ({
      path,
      prerender: { enabled: true, crawlLinks: false },
    })),
  },
});
