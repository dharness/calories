import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { config as loadEnv } from "dotenv";

import { appRouter } from "./router";
import { initCache } from "./usdaCache";

loadEnv();

// Initialize cache on startup
initCache();

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
  onError: ({ error }) => {
    console.error("tRPC error:", error);
  },
  responseMeta: () => ({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  }),
});

server.listen(3001, () => {
  console.log("tRPC server running on http://localhost:3001");
});
