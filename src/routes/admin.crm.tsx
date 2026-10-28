import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/crm")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/settings" });
  },
  component: () => null,
});
