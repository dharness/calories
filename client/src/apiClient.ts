import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../server/router";

const apiBase =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL || "http://localhost:3001";

export const apiClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: apiBase,
    }),
  ],
});
