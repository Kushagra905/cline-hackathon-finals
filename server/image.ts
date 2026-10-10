export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ImageCheck = { ok: true; mediaType: "image/png" | "image/jpeg" } | { ok: false; reason: "empty" | "too_large" | "not_png_or_jpeg" };

/** Validates by magic bytes, not by the client-declared type or file name. */
export function checkImageBytes(b: Uint8Array): ImageCheck {
  if (b.length === 0) return { ok: false, reason: "empty" };
  if (b.length > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return { ok: true, mediaType: "image/png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ok: true, mediaType: "image/jpeg" };
  return { ok: false, reason: "not_png_or_jpeg" };
}
