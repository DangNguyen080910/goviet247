import { Router } from "express";
import { prisma } from "../utils/db.js";

const router = Router();

router.get("/seo-routes", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 20000);
    const limit = Math.min(Math.max(requestedLimit, 1), 25000);
    const keys = String(req.query.keys || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean)
      .slice(0, 100);

    const routes = await prisma.seoRoute.findMany({
      where: {
        source: { not: { startsWith: "V2" } },
        ...(keys.length ? { key: { in: keys } } : {}),
      },
      select: {
        key: true,
        path: true,
        from: true,
        to: true,
        title: true,
        description: true,
        routeText: true,
        duration: true,
      },
      orderBy: { id: "asc" },
      take: limit,
    });

    return res.json({ success: true, data: { routes } });
  } catch (error) {
    console.error("[SEO] Load route catalog failed:", error);
    return res.status(500).json({ success: false, message: "Không tải được danh sách tuyến xe" });
  }
});

router.get("/seo-routes/:path", async (req, res) => {
  try {
    const routePath = String(req.params.path || "").trim();

    if (!routePath) {
      return res.status(400).json({ success: false, message: "Thiếu SEO path" });
    }

    const route = await prisma.seoRoute.findUnique({
      where: { path: routePath },
    });

    if (!route) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tuyến xe" });
    }

    const relatedRoutes = await prisma.seoRoute.findMany({
      where: {
        NOT: { id: route.id },
        OR: [
          { from: route.from },
          { to: route.to },
          { from: route.to },
          { to: route.from },
        ],
      },
      select: {
        key: true,
        path: true,
        from: true,
        to: true,
        title: true,
        description: true,
        routeText: true,
        duration: true,
      },
      take: 12,
    });

    const { id, createdAt, updatedAt, source, ...publicRoute } = route;

    return res.json({
      success: true,
      data: { route: publicRoute, relatedRoutes },
    });
  } catch (error) {
    console.error("[SEO] Load route failed:", error);
    return res.status(500).json({ success: false, message: "Không tải được tuyến xe" });
  }
});

export default router;
