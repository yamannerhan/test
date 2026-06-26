import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";

const rawPort = process.env.PORT ?? "8080";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const DEV_CACHE_VERSION = Date.now().toString();

const SW_TEMPLATE_PATH = path.resolve(import.meta.dirname, "public/sw-template.js");
const SW_OUTPUT_PATH = path.resolve(import.meta.dirname, "public/sw.js");
const swTemplate = fs.readFileSync(SW_TEMPLATE_PATH, "utf-8");
fs.writeFileSync(SW_OUTPUT_PATH, swTemplate.replace("__CACHE_VERSION__", DEV_CACHE_VERSION));

const VERSION_JSON_PATH = path.resolve(import.meta.dirname, "public/version.json");
fs.writeFileSync(VERSION_JSON_PATH, JSON.stringify({ v: DEV_CACHE_VERSION }));

const swVersionPlugin = {
  name: "sw-version-inject",
  transformIndexHtml(html: string) {
    return html.replace(/__BUILD_TS__/g, DEV_CACHE_VERSION);
  },
  closeBundle() {
    const outPath = path.resolve(import.meta.dirname, "dist/sw.js");
    const outPathAlt = path.resolve(import.meta.dirname, "dist/public/sw.js");
    const target = fs.existsSync(outPath) ? outPath : fs.existsSync(outPathAlt) ? outPathAlt : null;
    if (target) {
      const raw = fs.readFileSync(target, "utf-8");
      fs.writeFileSync(target, raw.replace("__CACHE_VERSION__", Date.now().toString()));
    }
  },
};

async function replitDevPlugins(): Promise<PluginOption[]> {
  if (process.env.NODE_ENV === "production" || process.env.REPL_ID === undefined) {
    return [];
  }

  const [cartographer, devBanner, runtimeOverlay] = await Promise.all([
    import("@replit/vite-plugin-cartographer"),
    import("@replit/vite-plugin-dev-banner"),
    import("@replit/vite-plugin-runtime-error-modal"),
  ]);

  return [
    cartographer.cartographer({
      root: path.resolve(import.meta.dirname, ".."),
    }),
    devBanner.devBanner(),
    runtimeOverlay.default(),
  ];
}

export default defineConfig(async () => ({
  base: basePath,
  plugins: [swVersionPlugin, react(), tailwindcss(), ...(await replitDevPlugins())],
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
}));
