import { useEffect, useState } from "react";
import { getLegacySeoRoutes } from "../api/seoRoutes";

const cachedRoutes = new Map();
const pendingRequests = new Map();

function loadRoutes(options) {
  const cacheKey = JSON.stringify(options);
  if (cachedRoutes.has(cacheKey)) return Promise.resolve(cachedRoutes.get(cacheKey));
  if (!pendingRequests.has(cacheKey)) {
    const request = getLegacySeoRoutes(options).then((routes) => {
      cachedRoutes.set(cacheKey, routes);
      return routes;
    }).finally(() => {
      pendingRequests.delete(cacheKey);
    });
    pendingRequests.set(cacheKey, request);
  }
  return pendingRequests.get(cacheKey);
}

export function useSeoRouteCatalog({ limit = 25000, keys = [] } = {}) {
  const keysValue = keys.join(",");
  const cacheKey = JSON.stringify({ limit, keys: keysValue });
  const options = { limit, keys: keysValue ? keysValue.split(",") : [] };
  const [routes, setRoutes] = useState(cachedRoutes.get(cacheKey) || []);

  useEffect(() => {
    let active = true;
    loadRoutes(options)
      .then((items) => {
        if (active) setRoutes(items);
      })
      .catch((error) => console.error("Load SEO route catalog failed:", error));
    return () => {
      active = false;
    };
  }, [cacheKey]);

  return routes;
}
