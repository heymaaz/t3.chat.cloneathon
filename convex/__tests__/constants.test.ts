import { describe, it, expect } from "vitest";
import {
  getMimeType,
  isSupportedFileExtension,
  isSupportedFileType,
  MAX_FILES,
  MAX_FILE_SIZE,
} from "../constants";

describe("getMimeType", () => {
  it("maps txt extension", () => {
    expect(getMimeType("foo.txt")).toBe("text/plain");
    expect(getMimeType("foo", "txt")).toBe("text/plain");
  });

  it("maps pdf extension", () => {
    expect(getMimeType("bar.pdf")).toBe("application/pdf");
    expect(getMimeType("bar", "pdf")).toBe("application/pdf");
  });

  it("maps docx extension", () => {
    expect(getMimeType("doc.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(getMimeType("doc", "docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(getMimeType("unknown.xyz")).toBe("application/octet-stream");
    expect(getMimeType("unknown", "xyz")).toBe("application/octet-stream");
  });
});

describe("isSupportedFileExtension", () => {
  it("returns true for supported extensions", () => {
    expect(isSupportedFileExtension("txt")).toBe(true);
    expect(isSupportedFileExtension("pdf")).toBe(true);
    expect(isSupportedFileExtension("docx")).toBe(true);
  });

  it("returns false for unsupported or missing extensions", () => {
    expect(isSupportedFileExtension(undefined)).toBe(false);
    expect(isSupportedFileExtension("exe")).toBe(false);
  });
});

describe("isSupportedFileType", () => {
  it("returns true for supported mime types", () => {
    expect(isSupportedFileType("text/plain")).toBe(true);
    expect(isSupportedFileType("application/pdf")).toBe(true);
    expect(
      isSupportedFileType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("returns false for unsupported mime types", () => {
    expect(isSupportedFileType("application/zip")).toBe(false);
  });
});

describe("constants", () => {
  it("exposes correct limits", () => {
    expect(MAX_FILES).toBe(10);
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });
});
