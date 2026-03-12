import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureTsconfigExclude, hasOpnsrcExclude, hasTsConfig } from "./tsconfig.js";

const TEST_DIR = join(process.cwd(), ".test-tsconfig");
const TSCONFIG_PATH = join(TEST_DIR, "tsconfig.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
});

describe("hasTsConfig", () => {
  it("returns false if tsconfig.json does not exist", () => {
    expect(hasTsConfig(TEST_DIR)).toBe(false);
  });

  it("returns true if tsconfig.json exists", async () => {
    await writeFile(TSCONFIG_PATH, "{}");
    expect(hasTsConfig(TEST_DIR)).toBe(true);
  });
});

describe("hasOpnsrcExclude", () => {
  it("returns false if tsconfig.json does not exist", async () => {
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(false);
  });

  it("returns false if no exclude array", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ compilerOptions: {} }));
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(false);
  });

  it("returns false if exclude array does not contain opnsrc", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["node_modules", "dist"] }));
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(false);
  });

  it("returns true if exclude contains opnsrc", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["node_modules", "opnsrc"] }));
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(true);
  });

  it("returns true if exclude contains opnsrc/", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["node_modules", "opnsrc/"] }));
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(true);
  });

  it("returns true if exclude contains ./opnsrc", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["node_modules", "./opnsrc"] }));
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(true);
  });

  it("returns false for invalid JSON", async () => {
    await writeFile(TSCONFIG_PATH, "{ invalid json }");
    expect(await hasOpnsrcExclude(TEST_DIR)).toBe(false);
  });
});

describe("ensureTsconfigExclude", () => {
  it("returns false if tsconfig.json does not exist", async () => {
    const result = await ensureTsconfigExclude(TEST_DIR);
    expect(result).toBe(false);
  });

  it("returns false if opnsrc already in exclude", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["opnsrc"] }));
    const result = await ensureTsconfigExclude(TEST_DIR);
    expect(result).toBe(false);
  });

  it("adds opnsrc to existing exclude array", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ exclude: ["node_modules", "dist"] }));
    const result = await ensureTsconfigExclude(TEST_DIR);
    expect(result).toBe(true);

    const content = JSON.parse(await readFile(TSCONFIG_PATH, "utf-8"));
    expect(content.exclude).toContain("opnsrc");
    expect(content.exclude).toContain("node_modules");
    expect(content.exclude).toContain("dist");
  });

  it("creates exclude array if it does not exist", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ compilerOptions: { strict: true } }));
    const result = await ensureTsconfigExclude(TEST_DIR);
    expect(result).toBe(true);

    const content = JSON.parse(await readFile(TSCONFIG_PATH, "utf-8"));
    expect(content.exclude).toEqual(["opnsrc"]);
    expect(content.compilerOptions.strict).toBe(true);
  });

  it("preserves other config options", async () => {
    const originalConfig = {
      compilerOptions: { target: "ES2020", module: "NodeNext", strict: true },
      include: ["src/**/*"],
    };
    await writeFile(TSCONFIG_PATH, JSON.stringify(originalConfig));
    await ensureTsconfigExclude(TEST_DIR);

    const content = JSON.parse(await readFile(TSCONFIG_PATH, "utf-8"));
    expect(content.compilerOptions).toEqual(originalConfig.compilerOptions);
    expect(content.include).toEqual(originalConfig.include);
    expect(content.exclude).toContain("opnsrc");
  });

  it("uses 2-space indentation", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({ compilerOptions: {} }));
    await ensureTsconfigExclude(TEST_DIR);
    const content = await readFile(TSCONFIG_PATH, "utf-8");
    expect(content).toMatch(/^ {2}"/m);
  });

  it("adds trailing newline", async () => {
    await writeFile(TSCONFIG_PATH, JSON.stringify({}));
    await ensureTsconfigExclude(TEST_DIR);
    const content = await readFile(TSCONFIG_PATH, "utf-8");
    expect(content).toMatch(/\n$/);
  });

  it("returns false for invalid JSON", async () => {
    await writeFile(TSCONFIG_PATH, "{ invalid json }");
    const result = await ensureTsconfigExclude(TEST_DIR);
    expect(result).toBe(false);
  });
});
