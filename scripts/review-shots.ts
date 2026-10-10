/// <reference lib="dom" />
/**
 * Lightweight UI review capture against a RUNNING server (npm start): ONE live extraction of the
 * synthetic example, then bounded viewport screenshots (desktop 1366x900, mobile 390x844, scale 1,
 * fullPage:false). Not a replacement for `npm run e2e`; it asserts nothing about the AI.
 *   npm start   (other terminal)   then   npx tsx scripts/review-shots.ts
 */
import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { shootViewports } from "./shots.js";

const URL = process.env.LC_URL ?? "http://127.0.0.1:8787";
const exe = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!exe) throw new Error("No Edge/Chrome found; set CHROME_PATH");

const DESKTOP = { width: 1366, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 1 };
const OUT = "scripts/out/review";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const log = (set: { path: string; w: number; h: number }[]) => set.forEach((s) => console.log(`${s.w}x${s.h}  ${s.path}`));
try {
  const page = await browser.newPage();
  await page.setViewport(DESKTOP);
  await page.goto(URL, { waitUntil: "networkidle0" });
  log(await shootViewports(page, `${OUT}/d1-upload`));

  await page.click('[data-testid="try-example"]');
  await page.waitForSelector('[data-testid="review-kfs"]', { timeout: 150_000 });
  log(await shootViewports(page, `${OUT}/d2-review`));

  // unconfirmed -> blocked state
  await page.click('[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="blocked"]');
  log(await shootViewports(page, `${OUT}/d3-blocked`, 3));

  for (const k of ["principal", "netCredited", "totalRepayment", "tenureDays", "repaymentCount"]) {
    const sel = `[data-testid="confirm-kfs-${k}"]`;
    if (await page.$(sel)) await page.click(sel);
  }
  await page.click('[data-testid="confirm-offer-netCredited"]');
  await page.click('[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="calc"]');
  log(await shootViewports(page, `${OUT}/d4-result-en`));

  await page.click('[data-testid="lang-hi"]');
  log(await shootViewports(page, `${OUT}/d5-result-hi`));

  await page.setViewport(MOBILE);
  log(await shootViewports(page, `${OUT}/m1-result-hi`));
  await page.click('[data-testid="lang-en"]');
  log(await shootViewports(page, `${OUT}/m2-result-en`));
} finally {
  await browser.close();
}
