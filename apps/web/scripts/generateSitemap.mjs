import fs from "fs";
import path from "path";
import { SEO_ROUTES } from "../src/data/seoRoutes/index.js";

const SITE_URL = "https://goviet247.com";
const today = new Date().toISOString().slice(0, 10);

const staticRoutes = [
  { path: "", priority: "1.0" },
  { path: "dat-xe", priority: "0.9" },
  { path: "privacy-policy", priority: "0.4" },
];

const seoRoutes = SEO_ROUTES.map((route) => ({
  path: route.path,
  priority: route.path.includes("tp-hcm") ? "0.92" : "0.85",
}));

const uniqueRoutes = [...staticRoutes, ...seoRoutes].filter(
  (route, index, arr) =>
    arr.findIndex((item) => item.path === route.path) === index,
);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueRoutes
  .map((route) => {
    const loc = route.path ? `${SITE_URL}/${route.path}` : `${SITE_URL}/`;

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${route.priority}</priority>
  </url>`;
  })
  .join("\n\n")}
</urlset>
`;

const outputPath = path.resolve("public/sitemap.xml");

fs.writeFileSync(outputPath, xml, "utf8");

console.log(`✅ Sitemap generated: ${outputPath}`);
console.log(`✅ Total URLs: ${uniqueRoutes.length}`);