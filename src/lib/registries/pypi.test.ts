import { describe, it, expect } from "vitest";
import { parsePyPISpec } from "./pypi.js";

describe("parsePyPISpec", () => {
  describe("package name only", () => {
    it("parses simple package name", () => {
      expect(parsePyPISpec("requests")).toEqual({ name: "requests", version: undefined });
    });

    it("parses package with hyphens", () => {
      expect(parsePyPISpec("scikit-learn")).toEqual({ name: "scikit-learn", version: undefined });
    });

    it("parses package with underscores", () => {
      expect(parsePyPISpec("typing_extensions")).toEqual({ name: "typing_extensions", version: undefined });
    });
  });

  describe("== version specifier (pip style)", () => {
    it("parses package==version", () => {
      expect(parsePyPISpec("requests==2.31.0")).toEqual({ name: "requests", version: "2.31.0" });
    });

    it("parses with whitespace", () => {
      expect(parsePyPISpec("requests == 2.31.0")).toEqual({ name: "requests", version: "2.31.0" });
    });
  });

  describe("@ version specifier", () => {
    it("parses package@version", () => {
      expect(parsePyPISpec("requests@2.31.0")).toEqual({ name: "requests", version: "2.31.0" });
    });

    it("parses complex package name@version", () => {
      expect(parsePyPISpec("scikit-learn@1.3.0")).toEqual({ name: "scikit-learn", version: "1.3.0" });
    });
  });

  describe("edge cases", () => {
    it("handles whitespace trimming", () => {
      expect(parsePyPISpec("  requests  ")).toEqual({ name: "requests", version: undefined });
    });

    it("handles prerelease versions", () => {
      expect(parsePyPISpec("pkg==1.0.0a1")).toEqual({ name: "pkg", version: "1.0.0a1" });
    });

    it("handles post release versions", () => {
      expect(parsePyPISpec("pkg==1.0.0.post1")).toEqual({ name: "pkg", version: "1.0.0.post1" });
    });
  });
});
