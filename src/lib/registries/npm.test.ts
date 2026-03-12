import { describe, expect, it } from "vitest";
import { parseNpmSpec } from "./npm.js";

describe("parseNpmSpec", () => {
  describe("regular packages", () => {
    it("parses package name only", () => {
      expect(parseNpmSpec("lodash")).toEqual({ name: "lodash", version: undefined });
    });

    it("parses package@version", () => {
      expect(parseNpmSpec("lodash@4.17.21")).toEqual({ name: "lodash", version: "4.17.21" });
    });

    it("parses package with semver range", () => {
      expect(parseNpmSpec("react@18.2.0")).toEqual({ name: "react", version: "18.2.0" });
    });

    it("parses package with tag", () => {
      expect(parseNpmSpec("next@canary")).toEqual({ name: "next", version: "canary" });
    });

    it("handles package names with dots", () => {
      expect(parseNpmSpec("socket.io")).toEqual({ name: "socket.io", version: undefined });
    });

    it("handles package names with hyphens", () => {
      expect(parseNpmSpec("react-dom@18.2.0")).toEqual({ name: "react-dom", version: "18.2.0" });
    });
  });

  describe("scoped packages", () => {
    it("parses scoped package name only", () => {
      expect(parseNpmSpec("@babel/core")).toEqual({ name: "@babel/core", version: undefined });
    });

    it("parses scoped package@version", () => {
      expect(parseNpmSpec("@babel/core@7.23.0")).toEqual({
        name: "@babel/core",
        version: "7.23.0",
      });
    });

    it("parses @types packages", () => {
      expect(parseNpmSpec("@types/node@20.10.0")).toEqual({
        name: "@types/node",
        version: "20.10.0",
      });
    });

    it("handles complex scoped names", () => {
      expect(parseNpmSpec("@emotion/react@11.11.0")).toEqual({
        name: "@emotion/react",
        version: "11.11.0",
      });
    });
  });

  describe("edge cases", () => {
    it("handles version with v prefix in version", () => {
      expect(parseNpmSpec("pkg@v1.0.0")).toEqual({ name: "pkg", version: "v1.0.0" });
    });

    it("handles prerelease versions", () => {
      expect(parseNpmSpec("pkg@1.0.0-beta.1")).toEqual({ name: "pkg", version: "1.0.0-beta.1" });
    });

    it("handles build metadata", () => {
      expect(parseNpmSpec("pkg@1.0.0+build.123")).toEqual({
        name: "pkg",
        version: "1.0.0+build.123",
      });
    });
  });
});
