import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { hasOpnsrcEntry, ensureGitignore, removeFromGitignore } from "./gitignore.js";

const TEST_DIR = join(process.cwd(), ".test-gitignore");
const GITIGNORE_PATH = join(TEST_DIR, ".gitignore");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
});

describe("hasOpnsrcEntry", () => {
  it("returns false if .gitignore does not exist", async () => {
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(false);
  });

  it("returns false if .gitignore has no opnsrc entry", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\ndist/\n");
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(false);
  });

  it("returns true if .gitignore has opnsrc/ entry", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\nopnsrc/\n");
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(true);
  });

  it("returns true if .gitignore has opnsrc entry (without slash)", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\nopnsrc\n");
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(true);
  });

  it("handles whitespace around entry", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\n  opnsrc/  \n");
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(true);
  });

  it("does not match partial entries", async () => {
    await writeFile(GITIGNORE_PATH, "my-opnsrc/\nopnsrc-backup/\n");
    expect(await hasOpnsrcEntry(TEST_DIR)).toBe(false);
  });
});

describe("ensureGitignore", () => {
  it("creates .gitignore with opnsrc entry if file does not exist", async () => {
    const result = await ensureGitignore(TEST_DIR);
    expect(result).toBe(true);
    expect(existsSync(GITIGNORE_PATH)).toBe(true);

    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).toContain("opnsrc/");
    expect(content).toContain("# opnsrc");
  });

  it("appends opnsrc entry to existing .gitignore", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\ndist/");

    const result = await ensureGitignore(TEST_DIR);
    expect(result).toBe(true);

    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain("dist/");
    expect(content).toContain("opnsrc/");
  });

  it("returns false if entry already exists", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\nopnsrc/\n");
    const result = await ensureGitignore(TEST_DIR);
    expect(result).toBe(false);
  });

  it("adds newline before entry if file does not end with newline", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/");
    await ensureGitignore(TEST_DIR);
    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).toMatch(/node_modules\/\n\n.*opnsrc/);
  });

  it("adds separator newline if file has content", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\n");
    await ensureGitignore(TEST_DIR);
    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).toContain("node_modules/\n\n");
  });
});

describe("removeFromGitignore", () => {
  it("returns false if .gitignore does not exist", async () => {
    const result = await removeFromGitignore(TEST_DIR);
    expect(result).toBe(false);
  });

  it("returns false if no opnsrc entry exists", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\ndist/\n");
    const result = await removeFromGitignore(TEST_DIR);
    expect(result).toBe(false);
  });

  it("removes opnsrc/ entry", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\nopnsrc/\ndist/\n");
    const result = await removeFromGitignore(TEST_DIR);
    expect(result).toBe(true);

    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).not.toContain("opnsrc/");
    expect(content).toContain("node_modules/");
    expect(content).toContain("dist/");
  });

  it("removes opnsrc entry (without slash)", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\nopnsrc\ndist/\n");
    await removeFromGitignore(TEST_DIR);
    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).not.toContain("opnsrc");
  });

  it("removes marker comment", async () => {
    await writeFile(
      GITIGNORE_PATH,
      "node_modules/\n\n# opnsrc - source code for packages\nopnsrc/\n",
    );
    await removeFromGitignore(TEST_DIR);
    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).not.toContain("# opnsrc");
    expect(content).not.toContain("opnsrc/");
  });

  it("cleans up multiple consecutive blank lines", async () => {
    await writeFile(GITIGNORE_PATH, "node_modules/\n\n\n\nopnsrc/\n\n\n\ndist/\n");
    await removeFromGitignore(TEST_DIR);
    const content = await readFile(GITIGNORE_PATH, "utf-8");
    expect(content).not.toMatch(/\n{3,}/);
  });
});
