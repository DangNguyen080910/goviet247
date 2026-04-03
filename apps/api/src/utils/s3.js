// Path: goviet247/apps/api/src/utils/s3.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ===== INIT S3 CLIENT =====
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;
const PREFIX =
  process.env.S3_ACCOUNTING_DOCUMENT_PREFIX || "accounting-documents";

// ===== HELPER: GENERATE KEY =====
export function buildS3Key({ year, quarter, fileName }) {
  const safeName = fileName.replace(/\s+/g, "_");
  const random = Math.random().toString(36).slice(2, 8);

  return `${PREFIX}/${year}/Q${quarter}/${Date.now()}_${random}_${safeName}`;
}

// ===== UPLOAD =====
export async function uploadBufferToS3({ buffer, key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3.send(command);

  return key;
}

// ===== DOWNLOAD =====
export async function getObjectStreamFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await s3.send(command);
  return response.Body; // stream
}

// ===== DELETE =====
export async function deleteObjectFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3.send(command);
}