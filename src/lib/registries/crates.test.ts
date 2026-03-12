import { describe, it, expect } from "vitest";
import { parseCratesSpec } from "./crates.js";

describe("parseCratesSpec", () => {
  describe("crate name only", () => {
    it("parses simple crate name", () => {
      expect(parseCratesSpec("serde")).toEqual({ name: "serde", version: undefined });
    });

    it("parses crate with hyphens", () => {
      expect(parseCratesSpec("tokio-util")).toEqual({ name: "tokio-util", version: undefined });
    });

    it("parses crate with underscores", () => {
      expect(parseCratesSpec("serde_json")).toEqual({ name: "serde_json", version: undefined });
    });
  });

  describe("@ version specifier", () => {
    it("parses crate@version", () => {
      expect(parseCratesSpec("serde@1.0.193")).toEqual({ name: "serde", version: "1.0.193" });
    });

    it("parses complex crate name@version", () => {
      expect(parseCratesSpec("tokio-util@0.7.10")).toEqual({ name: "tokio-util", version: "0.7.10" });
    });

    it("parses underscore crate@version", () => {
      expect(parseCratesSpec("serde_json@1.0.108")).toEqual({ name: "serde_json", version: "1.0.108" });
    });
  });

  describe("edge cases", () => {
    it("handles whitespace trimming", () => {
      expect(parseCratesSpec("  serde  ")).toEqual({ name: "serde", version: undefined });
    });

    it("handles prerelease versions", () => {
      expect(parseCratesSpec("tokio@1.0.0-alpha.1")).toEqual({ name: "tokio", version: "1.0.0-alpha.1" });
    });

    it("handles build metadata", () => {
      expect(parseCratesSpec("pkg@1.0.0+metadata")).toEqual({ name: "pkg", version: "1.0.0+metadata" });
    });
  });
});
