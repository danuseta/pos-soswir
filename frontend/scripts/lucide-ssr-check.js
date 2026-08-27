import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith(".svelte")) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const importPattern = /import\s*{([^}]+)}\s*from\s*["']lucide-svelte["']/g;

  for (const match of source.matchAll(importPattern)) {
    const localNames = match[1]
      .split(",")
      .map((item) => item.trim().split(/\s+as\s+/).at(-1))
      .filter(Boolean);

    for (const name of localNames) {
      if (new RegExp(`<${name}(?:\\s|/|>)`).test(source)) {
        violations.push(`${path.relative(sourceRoot, filePath)}: <${name}>`);
      }
    }
  }
}

walk(sourceRoot);

if (violations.length > 0) {
  console.error("Komponen lucide dirender langsung dan berisiko merusak SSR:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("PASS tidak ada komponen lucide yang dirender langsung di file Svelte");
}
