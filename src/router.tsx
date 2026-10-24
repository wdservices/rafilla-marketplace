import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Preload the destination route's chunk on hover/tap intent so clicks
    // feel instant instead of waiting on a network fetch after the click.
    defaultPreload: "intent",
    defaultPreloadDelay: 150,
  });

  return router;
};
