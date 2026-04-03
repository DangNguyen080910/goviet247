// Path: goviet247/apps/api/src/services/s3Service.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function sanitizeFileName(name) {
  return String(name || "")
    .replace(/\s+/g, "-")
    .replace(/[^\w.-]/g, "");
}

export function extractS3KeyFromUrlOrKey(value) {
  const raw = String(value || "").trim();

  if (!raw) return null;

  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

export async function uploadToS3({ file, folder = "public" }) {
  if (!file) {
    throw new Error("No file provided");
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.originalname);
  const key = `${folder}/${timestamp}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3.send(command);

  const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    key,
    url,
  };
}

export async function getSignedViewUrl(key, expiresIn = 300) {
  const safeKey = extractS3KeyFromUrlOrKey(key);

  if (!safeKey) {
    return null;
  }

  const bucket = process.env.AWS_S3_BUCKET;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: safeKey,
  });

  return getSignedUrl(s3, command, { expiresIn });
}