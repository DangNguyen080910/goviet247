import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/utils/db.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const routesDir = process.env.SEO_ROUTES_DIR
  ? path.resolve(process.env.SEO_ROUTES_DIR)
  : path.resolve(scriptDir, "../../../seo-import");
const batchSize = 2_000;

const routeFiles = fs
  .readdirSync(routesDir)
  .filter((name) => name !== "index.js" && /SeoRoutes(?:\d+)?\.js$/.test(name))
  .sort((a, b) => {
    const aIsHot = a.startsWith("V2HOTSeoRoutes");
    const bIsHot = b.startsWith("V2HOTSeoRoutes");

    if (aIsHot !== bIsHot) return aIsHot ? 1 : -1;

    const numberOf = (name) =>
      Number(name.match(/SeoRoutes(\d+)\.js$/)?.[1] || 0);
    return aIsHot ? numberOf(a) - numberOf(b) : a.localeCompare(b);
  });

if (!routeFiles.length) {
  throw new Error(`Không tìm thấy file SEO route trong ${routesDir}`);
}

let batch = [];
let parsed = 0;
let inserted = 0;

async function flushBatch() {
  if (!batch.length) return;

  const result = await prisma.seoRoute.createMany({
    data: batch,
    skipDuplicates: true,
  });

  inserted += result.count;
  batch = [];

  if (parsed % 10000 < batchSize) {
    console.log(`[SEO import] parsed=${parsed.toLocaleString("en-US")} inserted=${inserted.toLocaleString("en-US")}`);
  }
}

async function importFile(fileName) {
  const filePath = path.join(routesDir, fileName);
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let collecting = false;
  let objectLines = [];

  for await (const line of lines) {
    const trimmed = line.trim();

    if (!collecting) {
      if (trimmed === "{") {
        collecting = true;
        objectLines = [line];
      }
      continue;
    }

    objectLines.push(line);

    if (trimmed !== "}," && trimmed !== "}") continue;

    const required = [
      "key",
      "path",
      "from",
      "to",
      "title",
      "description",
      "routeText",
      "duration",
    ];

    const source = objectLines.join("\n");
    const route = Object.fromEntries(
      required.map((field) => {
        const pattern = new RegExp(
          `^\\s*${field}:\\s*(?:\\r?\\n\\s*)?("(?:\\\\.|[^"\\\\])*")\\s*,?`,
          "m",
        );
        const match = source.match(pattern);
        return [field, match ? JSON.parse(match[1]) : null];
      }),
    );

    if (required.some((field) => !route[field])) {
      throw new Error(`${fileName}: route thứ ${parsed + 1} thiếu field bắt buộc`);
    }

    batch.push({
      key: String(route.key),
      path: String(route.path),
      from: String(route.from),
      to: String(route.to),
      title: String(route.title),
      description: String(route.description),
      routeText: String(route.routeText),
      duration: String(route.duration),
      source: fileName.replace(/\.js$/, ""),
    });

    parsed += 1;
    collecting = false;
    objectLines = [];

    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }

  if (collecting) {
    throw new Error(`${fileName}: object cuối chưa đóng`);
  }
}

try {
  for (const fileName of routeFiles) {
    console.log(`[SEO import] ${fileName}`);
    await importFile(fileName);
  }

  await flushBatch();
  console.log(
    `[SEO import] Hoàn tất: parsed=${parsed.toLocaleString("en-US")} inserted=${inserted.toLocaleString("en-US")} skipped=${(parsed - inserted).toLocaleString("en-US")}`,
  );
} finally {
  await prisma.$disconnect();
}
