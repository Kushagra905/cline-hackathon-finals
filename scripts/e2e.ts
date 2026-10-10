/**
 * Browser end-to-end check against a RUNNING server (npm start). Uses real live AI extraction
 * (no cached fixtures/mocks) with the synthetic sample documents.
 *   npm start   (other terminal)   then   npm run e2e
 * Needs a local Edge/Chrome (puppeteer-core; no browser download).
 */
import { existsSync, mkdirSync } from "node:fs";
import puppeteer, { type Page } from "puppeteer-core";

const URL = process.env.LC_URL ?? "http://127.0.0.1:8787";
const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) throw new Error("No Edge/Chrome found; set CHROME_PATH");

const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

const text = (page: Page, sel: string) => page.$eval(sel, (e) => (e.textContent ?? "").trim()).catch(() => "");
const click = async (page: Page, sel: string) => {
  await page.waitForSelector(sel, { timeout: 15_000 });
  await page.click(sel);
};

async function extractWith(page: Page, offerSample: string | null, kfsSample: string) {
  await page.goto(URL, { waitUntil: "networkidle0" });
  if (offerSample) await click(page, `[data-testid="sample-${offerSample}"]`);
  await click(page, `[data-testid="sample-${kfsSample}"]`);
  await page.waitForSelector('[data-testid="picked-kfs"] img');
  await click(page, '[data-testid="extract"]');
  await page
    .waitForSelector('[data-testid="loading"]', { timeout: 5_000 })
    .then(() => check("loading state shown", true))
    .catch(() => check("loading state shown", false));
  await page.waitForSelector('[data-testid="review-kfs"]', { timeout: 150_000 });
}

async function confirmAll(page: Page, kind: string, keys: string[]) {
  for (const k of keys) await click(page, `[data-testid="confirm-${kind}-${k}"]`);
}

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
mkdirSync("scripts/out", { recursive: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  // ---- Flow A: both synthetic documents, live AI, full confirmation ----
  await extractWith(page, "offer-synthetic.png", "final-terms-synthetic.png");
  check("live AI badge on both documents", (await page.$$('[data-testid="live-badge"]')).length === 2);
  check("offer: net credited ₹9,500 found with evidence", (await text(page, '[data-testid="field-offer-netCredited"] .evidence')).includes("9,500"));
  check("offer: principal stays missing", (await text(page, '[data-testid="field-offer-principal"] [data-testid="status"]')) === "Missing");
  check("calculation not shown before confirmation", (await page.$('[data-testid="calc"]')) === null);

  await click(page, '[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="blocked"]');
  check("unconfirmed facts block numbers", (await page.$('[data-testid="cost"]')) === null);

  // repaymentCount is an AI-flagged structure fact: the user must review it too
  await confirmAll(page, "kfs", ["principal", "netCredited", "totalRepayment", "tenureDays", "repaymentCount"]);
  await confirmAll(page, "offer", ["netCredited"]);
  await click(page, '[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="calc"]');
  check("net credited ₹8,000.00", (await text(page, '[data-testid="net"]')) === "₹8,000.00", await text(page, '[data-testid="net"]'));
  check("total repayment ₹10,500.00", (await text(page, '[data-testid="repay"]')) === "₹10,500.00");
  check("borrowing cost ₹2,500.00 (no fee double count)", (await text(page, '[data-testid="cost"]')) === "₹2,500.00", await text(page, '[data-testid="cost"]'));
  check("duration 30 days", (await text(page, '[data-testid="duration"]')).startsWith("30"));
  const nd = await text(page, '[data-testid="diff-netCredited"] [data-testid="diff-state"]');
  check("net credited offer vs final differs", nd === "Differs", nd);
  const ev = await text(page, '[data-testid="diff-netCredited"]');
  check("evidence from both documents shown", ev.includes("9,500") && ev.includes("8,000"));
  check("principal not compared with net credited", (await text(page, '[data-testid="diff-principal"] [data-testid="diff-state"]')).startsWith("Not comparable"));
  await page.screenshot({ path: "scripts/out/e2e-result-en.png", fullPage: true });

  await click(page, '[data-testid="lang-hi"]');
  const hi = await text(page, '[data-testid="explanation"]');
  check("Hindi template explanation with same numbers", hi.includes("₹2,500.00") && /[\u0900-\u097F]/.test(hi), hi);
  await page.screenshot({ path: "scripts/out/e2e-result-hi.png", fullPage: true });

  // editing invalidates the result and un-confirms the field
  await click(page, '[data-testid="lang-en"]');
  await page.focus('[data-testid="input-kfs-netCredited"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.type("7,500");
  check("edit clears previous result", (await page.$('[data-testid="calc"]')) === null);
  check("edit un-confirms the field", (await text(page, '[data-testid="field-kfs-netCredited"] [data-testid="confirmed-state"]')).includes("Not confirmed"));
  await click(page, '[data-testid="confirm-kfs-netCredited"]');
  await click(page, '[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="calc"]');
  check("user-corrected value ₹7,500 -> cost ₹3,000.00", (await text(page, '[data-testid="cost"]')) === "₹3,000.00", await text(page, '[data-testid="cost"]'));

  // ---- Flow B: net credited not stated in final terms (principal-like amount is present) ----
  await extractWith(page, null, "final-terms-missing-net-synthetic.png");
  const st = await text(page, '[data-testid="field-kfs-netCredited"] [data-testid="status"]');
  check("missing-net doc: net credited is not 'Found'", st !== "Found", st);
  const cb = await page.$eval('[data-testid="confirm-kfs-netCredited"]', (b) => (b as unknown as { disabled: boolean }).disabled);
  check("cannot confirm a missing/ambiguous net credited", cb === true);
  await confirmAll(page, "kfs", ["totalRepayment", "tenureDays"]);
  if (await page.$('[data-testid="confirm-kfs-repaymentCount"]')) await click(page, '[data-testid="confirm-kfs-repaymentCount"]');
  await click(page, '[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="blocked"]');
  check(
    "missing net credited blocks the number",
    (await page.$('[data-testid="missing-netCredited"]')) !== null && (await page.$('[data-testid="cost"]')) === null,
  );
  await page.screenshot({ path: "scripts/out/e2e-blocked.png", fullPage: true });

  // ---- Error state: invalid bytes are rejected server-side ----
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/extract/kfs", { method: "POST", body: new Blob(["not an image"]) });
    return r.status;
  });
  check("server rejects non-PNG/JPEG bytes (400)", status === 400, String(status));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

