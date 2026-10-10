import { describe, expect, it } from "vitest";
import { normalizeExtraction } from "./cline/normalize.js";
import { checkImageBytes, MAX_IMAGE_BYTES } from "./image.js";

// Hand-written model-shaped objects testing server-side normalisation only. Not live AI output.
describe("normalizeExtraction", () => {
  it("parses rupee text to paise on the server and fills absent keys as missing", () => {
    const e = normalizeExtraction(
      { language: "en", fields: [{ key: "netCredited", status: "found", rupeeText: "₹8,000", supportingText: "Net credited ₹8,000" }] },
      "kfs",
    );
    expect(e.fields.find((f) => f.key === "netCredited")).toMatchObject({ status: "found", valuePaise: 800000, origin: "ai" });
    expect(e.fields.find((f) => f.key === "principal")).toMatchObject({ status: "missing", supportingText: "" });
    expect(e.fields).toHaveLength(10);
  });

  it("downgrades found-without-evidence or unparseable values to ambiguous", () => {
    const e = normalizeExtraction(
      {
        language: "hi",
        fields: [
          { key: "netCredited", status: "found", rupeeText: "₹8,000", supportingText: "" },
          { key: "totalRepayment", status: "found", rupeeText: "lots", supportingText: "repay lots" },
        ],
      },
      "kfs",
    );
    expect(e.fields.find((f) => f.key === "netCredited")?.status).toBe("ambiguous");
    expect(e.fields.find((f) => f.key === "totalRepayment")?.status).toBe("ambiguous");
    expect(e.warnings.length).toBe(2);
  });

  it("parses Hindi digits and keeps qualifiers", () => {
    const e = normalizeExtraction(
      { language: "hi", fields: [{ key: "principal", status: "found", rupeeText: "₹१०,०००", qualifier: "from", qualifierText: "से शुरू ₹१०,०००", supportingText: "₹१०,००० से शुरू" }] },
      "offer",
    );
    expect(e.fields.find((f) => f.key === "principal")).toMatchObject({ valuePaise: 1000000, qualifier: "from" });
  });

  it("rejects malformed model output", () => {
    expect(() => normalizeExtraction({ nope: true }, "kfs")).toThrow();
  });
});

describe("checkImageBytes", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  it("accepts PNG and JPEG by magic bytes and rejects others", () => {
    expect(checkImageBytes(png)).toEqual({ ok: true, mediaType: "image/png" });
    expect(checkImageBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: true, mediaType: "image/jpeg" });
    expect(checkImageBytes(new TextEncoder().encode("GIF89a....."))).toEqual({ ok: false, reason: "not_png_or_jpeg" });
    expect(checkImageBytes(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
  });
  it("enforces the 8MB limit", () => {
    expect(checkImageBytes(new Uint8Array(MAX_IMAGE_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
  });
});
