/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const apiPort = process.env.DEV_API_PORT || "8080";

export default defineConfig({
  clearScreen: false,
  plugins: [preact()],
  test: {
    environment: "jsdom",
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        ws: true,
        // Suppress ECONNREFUSED errors during startup while the Go server
        // is still compiling. The browser retries automatically.
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if (!res.headersSent && "writeHead" in res) {
              (res as import("http").ServerResponse).writeHead(502);
              (res as import("http").ServerResponse).end();
            }
          });
        },
      },
    },
  },
});
