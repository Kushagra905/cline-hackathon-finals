/// <reference lib="dom" />
/**
 * Browser end-to-end check against a RUNNING server (npm start). Uses real live AI extraction
 * (no cached fixtures/mocks) with the synthetic sample documents.
 *   npm start   (other terminal)   then   npm run e2e
 * Needs a local Edge/Chrome (puppeteer-core; no browser download).
 */
import { existsSync, mkdirSync } from "node:fs";
import puppeteer, { type Page } from "puppeteer-core";
import { shootViewports } from "./shots.js";

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

async function noOverflow(page: Page, name: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`no horizontal overflow: ${name}`, m.sw <= m.iw, `${m.sw}/${m.iw}`);
}

async function extractWith(page: Page, offerSample: string | null, kfsSample: string, viaTryExample = false) {
  await page.goto(URL, { waitUntil: "networkidle0" });
  if (viaTryExample) {
    await click(page, '[data-testid="try-example"]');
  } else {
    if (offerSample) await click(page, `[data-testid="sample-${offerSample}"]`);
    await click(page, `[data-testid="sample-${kfsSample}"]`);
    await page.waitForSelector('[data-testid="picked-kfs"] img');
    check("sample file is labelled synthetic", (await text(page, '[data-testid="source-kfs"]')).toLowerCase().includes("synthetic"));
    await click(page, '[data-testid="extract"]');
  }
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
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });

  // ---- Flow A: both synthetic documents, live AI, full confirmation ----
  // keyboard: first Tab lands on the skip link and shows a visible focus ring
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => { const e = document.activeElement as unknown as { className: string; ownerDocument: { defaultView: { getComputedStyle: (x: unknown) => { outlineStyle: string; outlineWidth: string } } } }; const s = e.ownerDocument.defaultView.getComputedStyle(e); return { cls: e.className, style: s.outlineStyle, w: s.outlineWidth }; });
  check("keyboard focus is visible on first Tab (skip link)", focus.cls === "skip" && focus.style !== "none" && parseFloat(focus.w) >= 2, JSON.stringify(focus));
  check("stepper starts at Upload", (await page.$eval('[data-testid="step-0"]', (e) => e.getAttribute("data-state"))) === "now");
  await noOverflow(page, "upload desktop");
  await shootViewports(page, "scripts/out/ui-desktop-1-upload");
  await extractWith(page, null, "", true); // prominent "Try a synthetic example" -> live AI on both samples
  check("stepper at Review after extraction", (await page.$eval('[data-testid="step-2"]', (e) => e.getAttribute("data-state"))) === "now");
  const rt = await text(page, '[data-testid="runtime"]');
  check("runtime panel: live call, model ID and tool executions reported", rt.includes("anthropic/") && rt.includes("submit_extraction") && /ran 1 time/.test(rt), rt.slice(0, 160));
  check("runtime panel lists both documents", (await page.$$('[data-testid^="runtime-"]')).length === 2);
  await noOverflow(page, "review desktop");
  await shootViewports(page, "scripts/out/ui-desktop-2-review");
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
  const chg = await text(page, '[data-testid="net-change-value"]');
  check("net credited change shown separately: −₹1,500.00 (not the cost)", chg.includes("1,500.00") && chg.includes("−") && !chg.includes("2,500"), chg);
  check("change and cost are different elements", (await text(page, '[data-testid="net-change"]')) !== (await text(page, '[data-testid="cost"]')));
  check("stepper reaches Costs", (await page.$eval('[data-testid="step-4"]', (e) => e.getAttribute("data-state"))) === "now");
  check("progress shows 3 of 3 critical facts", (await text(page, '[data-testid="progress"]')).includes("3 of 3"));
  const ptxt = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  check("no verdict/recommendation/APR wording", !/\b(scam|safe|fraud|apr|recommend|should (you )?(take|avoid))\b/.test(ptxt));
  await noOverflow(page, "result desktop");
  await shootViewports(page, "scripts/out/ui-desktop-3-result");

  await click(page, '[data-testid="lang-hi"]');
  const hi = await text(page, '[data-testid="explanation"]');
  check("Hindi template explanation with same numbers", hi.includes("₹2,500.00") && /[\u0900-\u097F]/.test(hi), hi);
  check("html lang switches to hi", (await page.evaluate(() => document.documentElement.lang)) === "hi");
  await noOverflow(page, "result desktop Hindi");
  await shootViewports(page, "scripts/out/ui-desktop-4-result-hindi");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await noOverflow(page, "result mobile Hindi 390px");
  await shootViewports(page, "scripts/out/ui-mobile-3-result-hindi");
  await click(page, '[data-testid="lang-en"]');
  await noOverflow(page, "result mobile English 390px");
  await shootViewports(page, "scripts/out/ui-mobile-1-result");
  const tiny = await page.evaluate(() =>
    [...document.querySelectorAll("button, input:not([type=file]), a")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40) && !(e as HTMLElement).classList.contains("skip"); }).length,
  );
  check("mobile controls are at least 40px (touch targets)", tiny === 0, `${tiny} too small`);
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });

  // editing invalidates the result and un-confirms the field
  await click(page, '[data-testid="lang-en"]');
  await page.focus('[data-testid="input-kfs-netCredited"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.type("7,500");
  check("edit clears previous result", (await page.$('[data-testid="calc"]')) === null);
  check("edit un-confirms the field", (await text(page, '[data-testid="field-kfs-netCredited"] [data-testid="confirmed-state"]')).includes("Not confirmed"));
  check("edit hides the stale net-change figure", (await page.$('[data-testid="net-change"]')) === null);
  check("edited value is labelled 'User edited'", (await text(page, '[data-testid="field-kfs-netCredited"] [data-testid="edited-badge"]')) === "User edited");
  const hist = await text(page, '[data-testid="history-kfs-netCredited"]');
  check("original document value kept as history, not proof", hist.includes("8,000") && /not (evidence|proof)|history/i.test(hist), hist.slice(0, 200));
  check("edit does not alter the original AI extraction shown as history", hist.includes("Net amount credited"));
  await shootViewports(page, "scripts/out/ui-desktop-5-edited");
  await click(page, '[data-testid="confirm-kfs-netCredited"]');
  await click(page, '[data-testid="calculate"]');
  await page.waitForSelector('[data-testid="calc"]');
  check("user-corrected value ₹7,500 -> cost ₹3,000.00", (await text(page, '[data-testid="cost"]')) === "₹3,000.00", await text(page, '[data-testid="cost"]'));
  const ed = await text(page, '[data-testid="diff-netCredited"]');
  check("comparison shows edited final value with history-only evidence", ed.includes("7,500") && ed.includes("User edited"), ed.slice(0, 220));
  check("net change recomputed from edited value (−₹2,000.00)", (await text(page, '[data-testid="net-change-value"]')).includes("2,000.00"));

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
  check("blocked panel uses amber 'cannot calculate' wording, not a verdict", (await text(page, '[data-testid="blocked"]')).toLowerCase().includes("cannot calculate"));
  check("unresolved field is flagged 'Needs your attention'", (await text(page, '[data-testid="field-kfs-netCredited"]')).includes("Needs your attention"));
  check("stepper stays before Costs while blocked", (await page.$eval('[data-testid="step-4"]', (e) => e.getAttribute("data-state"))) === "todo");
  await noOverflow(page, "blocked desktop");
  await shootViewports(page, "scripts/out/ui-desktop-6-blocked");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await noOverflow(page, "blocked mobile 390px");
  await shootViewports(page, "scripts/out/ui-mobile-2-blocked");
  await page.goto(URL, { waitUntil: "networkidle0" });
  await noOverflow(page, "upload mobile 390px");
  await shootViewports(page, "scripts/out/ui-mobile-0-upload");
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });

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

