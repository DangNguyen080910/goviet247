// Path: goviet247/apps/rider-mobile/constants/api.ts
import { Platform } from "react-native";

const DEFAULT_PRODUCTION_API_BASE = "https://api.goviet247.com";

const ENV_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = (
  ENV_API_BASE && ENV_API_BASE.length > 0
    ? ENV_API_BASE
    : Platform.OS === "web"
      ? "http://localhost:5050"
      : DEFAULT_PRODUCTION_API_BASE
).replace(/\/+$/, "");