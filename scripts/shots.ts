/// <reference lib="dom" />
/**
 * Bounded review screenshots. Never uses fullPage: each image is one viewport, so a long page is
 * captured as several scrolled slices. Dimensions are read from the PNG header and verified, so an
 * oversized image can never reach an image-reading tool (API limit is 8000px; we stay far below).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "puppeteer-core";

export const MAX_SIDE_PX = 2000;
const MAX_SLICES = 12;

/** Width/height from a PNG IHDR chunk (bytes 16-23, big-endian). */
export function pngSize(buf: Uint8Array): { w: number; h: number } {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 24 || v.getUint32(0) !== 0x89504e47) throw new Error("not a PNG");
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

/**
 * Capture the page as consecutive viewport-sized slices: `<base>-1.png`, `<base>-2.png`, ...
 * Returns the written paths with verified sizes. The viewport itself must be within MAX_SIDE_PX.
 */
export async function shootViewports(page: Page, base: string, maxSlices = MAX_SLICES): Promise<{ path: string; w: number; h: number }[]> {
  const vp = page.viewport();
  if (!vp || vp.width > MAX_SIDE_PX || vp.height > MAX_SIDE_PX) throw new Error(`viewport too large for review screenshots: ${JSON.stringify(vp)}`);
  mkdirSync(base.replace(/[\\/][^\\/]*$/, "") || ".", { recursive: true });
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const count = Math.max(1, Math.min(maxSlices, Math.ceil(total / vp.height)));
  const out: { path: string; w: number; h: number }[] = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vp.height);
    await new Promise((r) => setTimeout(r, 120));
    const buf = (await page.screenshot({ fullPage: false, captureBeyondViewport: false, type: "png" })) as Uint8Array;
    const { w, h } = pngSize(buf);
    if (w > MAX_SIDE_PX || h > MAX_SIDE_PX) throw new Error(`screenshot ${w}x${h} exceeds ${MAX_SIDE_PX}px bound`);
    const path = `${base}-${i + 1}.png`;
    writeFileSync(path, buf);
    out.push({ path, w, h });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
}
