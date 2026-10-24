import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/notify-tick?key=SECRET — cron pipeline for the notification system.
 *
 * CPanel cron (every 5–15 min):
 *   curl -s "https://your-domain/api/notify-tick?key=$NOTIFY_CRON_SECRET"
 *
 * Drains the Firestore `mail` queue through Resend, fans out web-push from the
 * `pushOutbox` to stored device subscriptions, and fires draw-time reminders.
 * Idempotent: every queue doc carries its own delivery/status state.
 */
async function jsonResponse(body: unknown, status: number): Promise<Response> {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/notify-tick")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = (process.env["NOTIFY_CRON_SECRET"] || "").trim();
        if (!secret) {
          return jsonResponse({ ok: false, error: "NOTIFY_CRON_SECRET is not set" }, 503);
        }

        const url = new URL(request.url);
        const given = (
          url.searchParams.get("key") ||
          request.headers.get("x-notify-key") ||
          ""
        ).trim();

        const { timingSafeEqual } = await import("node:crypto");
        const a = Buffer.from(given, "utf8");
        const b = Buffer.from(secret, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
        }

        const { runNotifyTick } = await import("@/lib/notify-worker");
        const origin = (process.env["SITE_ORIGIN"] || "").trim() || "https://raffila.com";
        const report = await runNotifyTick({ origin });
        return jsonResponse(report, 200);
      },
    },
  },
});
