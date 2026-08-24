// apps/web/scripts/generateSitemap.mjs
import fs from "fs";
import path from "path";
import { SEO_ROUTES } from "../src/data/seoRoutes/index.js";
import { prisma } from "../../api/src/utils/db.js";

const SITE_URL = "https://goviet247.com";
const today = new Date().toISOString().slice(0, 10);
const MAX_URLS_PER_SITEMAP = 45_000;
const PUBLIC_DIR = path.resolve("public");

const staticRoutes = [
  { path: "", priority: "1.0" },
  { path: "dat-xe", priority: "0.9" },
  { path: "privacy-policy", priority: "0.4" },
];

const seoRoutes = SEO_ROUTES.map((route) => ({
  path: route.path,
  priority: route.path.includes("tp-hcm") ? "0.92" : "0.85",
  lastmod: route.lastmod,
}));

let cursorId;

try {
  while (true) {
    const batch = await prisma.seoRoute.findMany({
      orderBy: { id: "asc" },
      take: 10_000,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, path: true, updatedAt: true },
    });

    if (!batch.length) break;

    for (const route of batch) {
      seoRoutes.push({
        path: route.path,
        priority: route.path.includes("tp-hcm") ? "0.92" : "0.85",
        lastmod: route.updatedAt.toISOString().slice(0, 10),
      });
    }

    cursorId = batch.at(-1).id;
  }
} finally {
  await prisma.$disconnect();
}

const allRoutes = [...staticRoutes, ...seoRoutes];

const pathMap = new Map();

for (const route of allRoutes) {
  if (pathMap.has(route.path)) {
    continue;
  }

  pathMap.set(route.path, route);
}

const uniqueRoutes = [...pathMap.values()];

const unescapeXml = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const SITEMAP_INDEX_FILE_NAME = "sitemap.xml";
const getSitemapFileName = (index) => `sitemap-${index + 1}.xml`;

const existingLastmodByUrl = new Map();
const existingSitemapFiles = fs.existsSync(PUBLIC_DIR)
  ? fs
      .readdirSync(PUBLIC_DIR)
      .filter((fileName) => /^sitemap(?:-?\d+)?\.xml$/.test(fileName))
  : [];

for (const fileName of existingSitemapFiles) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  const existingXml = fs.readFileSync(filePath, "utf8");
  const urlPattern = /<url>\s*<loc>([\s\S]*?)<\/loc>[\s\S]*?<lastmod>([\s\S]*?)<\/lastmod>[\s\S]*?<\/url>/g;

  for (const match of existingXml.matchAll(urlPattern)) {
    const loc = unescapeXml(match[1].trim());
    const lastmod = match[2].trim();

    if (!existingLastmodByUrl.has(loc)) {
      existingLastmodByUrl.set(loc, lastmod);
    }
  }
}

const routesWithMetadata = uniqueRoutes.map((route) => {
  const loc = route.path ? `${SITE_URL}/${route.path}` : `${SITE_URL}/`;

  return {
    ...route,
    loc,
    lastmod: route.lastmod ?? existingLastmodByUrl.get(loc) ?? today,
  };
});

const sitemapChunks = [];

for (
  let start = 0;
  start < routesWithMetadata.length;
  start += MAX_URLS_PER_SITEMAP
) {
  sitemapChunks.push(
    routesWithMetadata.slice(start, start + MAX_URLS_PER_SITEMAP),
  );
}

const createdSitemapFiles = [];
const sitemapIndexEntries = [];

for (const [index, routes] of sitemapChunks.entries()) {
  const fileName = getSitemapFileName(index);
  const outputPath = path.join(PUBLIC_DIR, fileName);
  const isNewFile = !fs.existsSync(outputPath);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map((route) => {
    return `  <url>
    <loc>${escapeXml(route.loc)}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <priority>${route.priority}</priority>
  </url>`;
  })
  .join("\n\n")}
</urlset>
`;

  fs.writeFileSync(outputPath, xml, "utf8");

  if (isNewFile) {
    createdSitemapFiles.push(fileName);
  }

  sitemapIndexEntries.push({
    fileName,
    lastmod: routes.reduce(
      (latest, route) => (route.lastmod > latest ? route.lastmod : latest),
      routes[0]?.lastmod ?? today,
    ),
  });

  console.log(`✅ ${fileName}: ${routes.length.toLocaleString("en-US")} URLs`);
}

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapIndexEntries
  .map(({ fileName, lastmod }) => {
    return `  <sitemap>
    <loc>${escapeXml(`${SITE_URL}/${fileName}`)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
  })
  .join("\n\n")}
</sitemapindex>
`;

fs.writeFileSync(
  path.join(PUBLIC_DIR, SITEMAP_INDEX_FILE_NAME),
  sitemapIndexXml,
  "utf8",
);

console.log(
  `✅ ${SITEMAP_INDEX_FILE_NAME}: ${sitemapIndexEntries.length.toLocaleString("en-US")} sitemap files`,
);

const generatedFileNames = new Set(
  sitemapChunks.map((_, index) => getSitemapFileName(index)),
);
generatedFileNames.add(SITEMAP_INDEX_FILE_NAME);
const staleSitemapFiles = existingSitemapFiles.filter(
  (fileName) => !generatedFileNames.has(fileName),
);

console.log(`✅ Total URLs: ${routesWithMetadata.length.toLocaleString("en-US")}`);
console.log(`✅ Maximum per sitemap: ${MAX_URLS_PER_SITEMAP.toLocaleString("en-US")}`);

if (createdSitemapFiles.length > 0) {
  console.log("\n🆕 New sitemap files created:");

  for (const fileName of createdSitemapFiles) {
    console.log(`   ${SITE_URL}/${fileName}`);
  }

  console.log(
    `⚠️ Deploy and submit only ${SITE_URL}/${SITEMAP_INDEX_FILE_NAME} in Google Search Console.`,
  );
}

if (staleSitemapFiles.length > 0) {
  console.warn("\n⚠️ Sitemap files no longer needed (not deleted automatically):");

  for (const fileName of staleSitemapFiles) {
    console.warn(`   ${path.join(PUBLIC_DIR, fileName)}`);
  }
}
