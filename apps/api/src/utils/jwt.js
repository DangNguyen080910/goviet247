// Path: goviet247/apps/api/src/utils/jwt.js
import jwt from "jsonwebtoken";

function mustHaveSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("Thiếu JWT_SECRET trong .env");
  }
}

function mustHaveAdminSecret() {
  if (!process.env.ADMIN_JWT_SECRET) {
    throw new Error("Thiếu ADMIN_JWT_SECRET trong .env");
  }
}

export function signToken(payload) {
  mustHaveSecret();
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "7d",
  });
}

export function verifyJwtToken(token) {
  mustHaveSecret();
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ✅ Admin token
export function signAdminToken(payload) {
  mustHaveAdminSecret();
  return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES || "7d",
  });
}

export function verifyAdminJwtToken(token) {
  mustHaveAdminSecret();
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET);
}
