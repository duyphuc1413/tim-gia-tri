import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileDir, "..");
const outDir = path.join(mobileDir, "www");

const ROOT_FILES = [
  "index.html",
  "daily.html",
  "compare.html",
  "account.html",
  "workshop.html",
  "privacy.html",
  "manifest.webmanifest"
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ROOT_FILES) {
  const src = path.join(repoRoot, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, file));
  }
}

fs.cpSync(path.join(repoRoot, "assets"), path.join(outDir, "assets"), { recursive: true });
console.log("Đã đồng bộ mã nguồn web sang mobile/www/ thành công.");
