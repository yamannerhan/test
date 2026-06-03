import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

const DEV_CACHE_VERSION = Date.now().toString();

// Write public/sw.js with current timestamp immediately at server start
const SW_TEMPLATE_PATH = path.resolve(import.meta.dirname, "public/sw.js");
const swTemplateContent = fs.readFileSync(SW_TEMPLATE_PATH, "utf-8");
if (swTemplateContent.includes("__CACHE_VERSION__")) {
  fs.writeFileSync(SW_TEMPLATE_PATH, swTemplateContent.replace("__CACHE_VERSION__", DEV_CACHE_VERSION));
}

const swVersionPlugin = {
  name: "sw-version-inject",
  closeBundle() {
    const outPath = path.resolve(import.meta.dirname, "dist/public/sw.js");
    if (fs.existsSync(outPath)) {
      const raw = fs.readFileSync(outPath, "utf-8");
      if (raw.includes("__CACHE_VERSION__")) {
        fs.writeFileSync(outPath, raw.replace("__CACHE_VERSION__", Date.now().toString()));
      }
    }
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    swVersionPlugin,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
