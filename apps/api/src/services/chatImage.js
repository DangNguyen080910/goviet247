import sharp from 'sharp';
export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// Decode and re-encode untrusted uploads. Strip EXIF/GPS and cap pixels and output size.
export async function prepareChatImage(buffer) {
  const fail = () => Object.assign(new Error('Ảnh không hợp lệ. Chọn ảnh JPEG, PNG hoặc WebP, tối đa 10 MB.'), {status: 400});
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > CHAT_IMAGE_MAX_BYTES) throw fail();
  try {
    const image = sharp(buffer, {limitInputPixels: 40000000, failOn: 'warning'});
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) throw fail();
    const output = await image.rotate().resize({width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 82}).toBuffer();
    if (output.length > 5 * 1024 * 1024) throw fail();
    return {buffer: output, mimetype: 'image/jpeg'};
  } catch { throw fail(); }
}
