import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  clearScreen: false,
  plugins: [preact()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
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
