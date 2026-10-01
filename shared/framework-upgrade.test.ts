import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  cropImageRegion,
  parseOfficeDocument,
} from "@agent-native/core/ingestion";
import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

const require = createRequire(import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("Agent-Native upgrade runtime peers", () => {
  it("installs matching framework and template corpus releases", () => {
    const installedVersion = (name: string) =>
      JSON.parse(
        readFileSync(
          new URL(`../node_modules/${name}/package.json`, import.meta.url),
          "utf8",
        ),
      ).version;
    const version = installedVersion("@agent-native/core");
    for (const name of [
      "@agent-native/agentkit",
      "@agent-native/toolkit",
      "@agent-native/core-corpus",
    ]) {
      expect(installedVersion(name)).toBe(version);
    }
    expect(manifest["agent-native"].scaffold.templateRef).toBe(
      "@agent-native/core@0.182.1",
    );
  });

  it("keeps Office and extension peers resolvable", () => {
    for (const name of [
      "officeparser",
      "mammoth",
      "prettier",
      "@anthropic-ai/tokenizer",
    ]) {
      expect(require.resolve(name)).toBeTruthy();
    }
  });

  it("parses an in-memory reference spreadsheet through Core", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["example requirement"], ["example value"]]),
      "Example",
    );
    const result = await parseOfficeDocument({
      data: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
      fileName: "example.xlsx",
    });
    expect(result.text).toContain("example requirement");
    expect(result.text).toContain("example value");
  });

  it("parses an in-memory reference DOCX through Core", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    zip.file(
      "word/document.xml",
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Example reference document</w:t></w:r></w:p></w:body></w:document>',
    );
    const result = await parseOfficeDocument({
      data: await zip.generateAsync({ type: "uint8array" }),
      fileName: "example.docx",
    });
    expect(result.text).toContain("Example reference document");
  });

  it("processes an in-memory reference image through Core", async () => {
    const data = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const result = await cropImageRegion({
      data,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
    expect(result.width).toBe(1);
    expect(result.mimeType).toBe("image/png");
  });
});
