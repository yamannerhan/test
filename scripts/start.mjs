#!/usr/bin/env node
/**
 * Production bootstrap: env defaults, DB schema sync, then start API server.
 * Run on every deploy so the app works on any fresh Postgres instance.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(msg) {
  console.log(`[bootstrap] ${msg}`);
}

function fail(msg) {
  console.error(`[bootstrap] HATA: ${msg}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail(
    "DATABASE_URL tanimli degil. Postgres servisini baglayin (Railway: Variables -> Add Reference -> Postgres.DATABASE_URL).",
  );
}

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  log("SESSION_SECRET otomatik uretildi (kalici oturum icin Variables'a ekleyin).");
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = process.env.SESSION_SECRET;
  log("JWT_SECRET = SESSION_SECRET olarak ayarlandi.");
}

process.env.NODE_ENV ??= "production";
process.env.BASE_PATH ??= "/";

for (const dir of ["uploads/avatars", "uploads/parttime"]) {
  fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
}

const staticDir = path.join(rootDir, "artifacts/ozel-guvenlik/dist/public");
if (!fs.existsSync(path.join(staticDir, "index.html"))) {
  log("UYARI: Frontend build bulunamadi, yalnizca API calisacak.");
}

log("Veritabani semasi uygulaniyor...");
const push = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push-force"], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (push.status !== 0) {
  fail("Veritabani semasi uygulanamadi. DATABASE_URL ve Postgres erisimini kontrol edin.");
}

log("Veritabani hazir. Sunucu baslatiliyor...");

const server = spawnSync(
  "node",
  ["--enable-source-maps", path.join(rootDir, "artifacts/api-server/dist/index.mjs")],
  { cwd: rootDir, env: process.env, stdio: "inherit" },
);

process.exit(server.status ?? 1);
