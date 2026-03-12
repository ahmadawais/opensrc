import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  hasOpnsrcSection,
  ensureAgentsMd,
  updateAgentsMd,
  updatePackageIndex,
  removeOpnsrcSection,
} from "./agents.js";

const TEST_DIR = join(process.cwd(), ".test-agents");
const AGENTS_FILE = join(TEST_DIR, "AGENTS.md");
const OPNSRC_DIR = join(TEST_DIR, "opnsrc");
const SOURCES_FILE = join(OPNSRC_DIR, "sources.json");

const SECTION_MARKER = "<!-- opnsrc:start -->";
const SECTION_END_MARKER = "<!-- opnsrc:end -->";

beforeEach(async () => {
  await mkdir(OPNSRC_DIR, { recursive: true });
});

afterEach(async () => {
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }
});

describe("hasOpnsrcSection", () => {
  it("returns false if AGENTS.md does not exist", async () => {
    expect(await hasOpnsrcSection(TEST_DIR)).toBe(false);
  });

  it("returns false if AGENTS.md exists but has no section", async () => {
    await writeFile(AGENTS_FILE, "# AGENTS.md\n\nSome content");
    expect(await hasOpnsrcSection(TEST_DIR)).toBe(false);
  });

  it("returns true if AGENTS.md has the opnsrc section", async () => {
    await writeFile(
      AGENTS_FILE,
      `# AGENTS.md\n\n${SECTION_MARKER}\nContent\n${SECTION_END_MARKER}`,
    );
    expect(await hasOpnsrcSection(TEST_DIR)).toBe(true);
  });
});

describe("ensureAgentsMd", () => {
  it("creates AGENTS.md if it does not exist", async () => {
    const result = await ensureAgentsMd(TEST_DIR);
    expect(result).toBe(true);
    expect(existsSync(AGENTS_FILE)).toBe(true);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).toContain("# AGENTS.md");
    expect(content).toContain(SECTION_MARKER);
    expect(content).toContain(SECTION_END_MARKER);
    expect(content).toContain("## Source Code Reference");
  });

  it("appends section to existing AGENTS.md without section", async () => {
    await writeFile(AGENTS_FILE, "# AGENTS.md\n\nExisting content here.");

    const result = await ensureAgentsMd(TEST_DIR);
    expect(result).toBe(true);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).toContain("Existing content here.");
    expect(content).toContain(SECTION_MARKER);
    expect(content).toContain("npx opnsrc");
  });

  it("returns false if section already exists and is up to date", async () => {
    await ensureAgentsMd(TEST_DIR);
    const result = await ensureAgentsMd(TEST_DIR);
    expect(result).toBe(false);
  });

  it("updates section if content has changed", async () => {
    const oldSection = `${SECTION_MARKER}\n\nOld content\n\n${SECTION_END_MARKER}`;
    await writeFile(AGENTS_FILE, `# AGENTS.md\n\n${oldSection}`);

    const result = await ensureAgentsMd(TEST_DIR);
    expect(result).toBe(true);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).not.toContain("Old content");
    expect(content).toContain("Source Code Reference");
  });

  it("preserves content before and after section when updating", async () => {
    const oldSection = `${SECTION_MARKER}\n\nOld content\n\n${SECTION_END_MARKER}`;
    await writeFile(
      AGENTS_FILE,
      `# Header\n\nBefore content\n\n${oldSection}\n\nAfter content`,
    );

    await ensureAgentsMd(TEST_DIR);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).toContain("# Header");
    expect(content).toContain("Before content");
    expect(content).toContain("After content");
    expect(content).toContain("Source Code Reference");
  });
});

describe("updatePackageIndex", () => {
  it("creates sources.json with packages", async () => {
    const sources = {
      packages: [
        {
          name: "zod",
          version: "3.22.0",
          registry: "npm" as const,
          path: "repos/github.com/colinhacks/zod",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      repos: [],
    };

    await updatePackageIndex(sources, TEST_DIR);

    expect(existsSync(SOURCES_FILE)).toBe(true);
    const content = JSON.parse(await readFile(SOURCES_FILE, "utf-8"));
    expect(content.packages).toHaveLength(1);
    expect(content.packages[0].name).toBe("zod");
    expect(content.packages[0].registry).toBe("npm");
  });

  it("creates sources.json with repos", async () => {
    const sources = {
      packages: [],
      repos: [
        {
          name: "github.com/vercel/ai",
          version: "main",
          path: "repos/github.com/vercel/ai",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    await updatePackageIndex(sources, TEST_DIR);

    const content = JSON.parse(await readFile(SOURCES_FILE, "utf-8"));
    expect(content.repos).toHaveLength(1);
    expect(content.repos[0].name).toBe("github.com/vercel/ai");
  });

  it("omits packages key if no packages", async () => {
    const sources = {
      packages: [],
      repos: [
        {
          name: "github.com/vercel/ai",
          version: "main",
          path: "repos/github.com/vercel/ai",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    await updatePackageIndex(sources, TEST_DIR);

    const content = JSON.parse(await readFile(SOURCES_FILE, "utf-8"));
    expect(content.packages).toBeUndefined();
    expect(content.repos).toBeDefined();
  });

  it("omits repos key if no repos", async () => {
    const sources = {
      packages: [
        {
          name: "zod",
          version: "3.22.0",
          registry: "npm" as const,
          path: "repos/github.com/colinhacks/zod",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      repos: [],
    };

    await updatePackageIndex(sources, TEST_DIR);

    const content = JSON.parse(await readFile(SOURCES_FILE, "utf-8"));
    expect(content.packages).toBeDefined();
    expect(content.repos).toBeUndefined();
  });

  it("removes sources.json if no sources", async () => {
    await writeFile(SOURCES_FILE, JSON.stringify({ packages: [], repos: [] }));

    await updatePackageIndex({ packages: [], repos: [] }, TEST_DIR);

    expect(existsSync(SOURCES_FILE)).toBe(false);
  });

  it("includes updatedAt timestamp", async () => {
    const sources = {
      packages: [
        {
          name: "zod",
          version: "3.22.0",
          registry: "npm" as const,
          path: "repos/github.com/colinhacks/zod",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      repos: [],
    };

    await updatePackageIndex(sources, TEST_DIR);

    const content = JSON.parse(await readFile(SOURCES_FILE, "utf-8"));
    expect(content.updatedAt).toBeDefined();
    expect(new Date(content.updatedAt).getTime()).not.toBeNaN();
  });
});

describe("updateAgentsMd", () => {
  it("updates both sources.json and AGENTS.md", async () => {
    const sources = {
      packages: [
        {
          name: "zod",
          version: "3.22.0",
          registry: "npm" as const,
          path: "repos/github.com/colinhacks/zod",
          fetchedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      repos: [],
    };

    await updateAgentsMd(sources, TEST_DIR);

    expect(existsSync(SOURCES_FILE)).toBe(true);
    expect(existsSync(AGENTS_FILE)).toBe(true);
  });

  it("does not create AGENTS.md if no sources", async () => {
    await updateAgentsMd({ packages: [], repos: [] }, TEST_DIR);
    expect(existsSync(AGENTS_FILE)).toBe(false);
  });

  it("removes opnsrc section from AGENTS.md when sources become empty", async () => {
    const pkg = {
      name: "zod",
      version: "3.22.0",
      registry: "npm" as const,
      path: "repos/github.com/colinhacks/zod",
      fetchedAt: "2024-01-01T00:00:00.000Z",
    };

    await updateAgentsMd({ packages: [pkg], repos: [] }, TEST_DIR);
    expect(existsSync(AGENTS_FILE)).toBe(true);
    const contentBefore = await readFile(AGENTS_FILE, "utf-8");
    expect(contentBefore).toContain(SECTION_MARKER);

    const result = await updateAgentsMd({ packages: [], repos: [] }, TEST_DIR);
    expect(result).toBe(true);

    const contentAfter = await readFile(AGENTS_FILE, "utf-8");
    expect(contentAfter).not.toContain(SECTION_MARKER);
    expect(contentAfter).not.toContain(SECTION_END_MARKER);
  });
});

describe("removeOpnsrcSection", () => {
  it("returns false if AGENTS.md does not exist", async () => {
    const result = await removeOpnsrcSection(TEST_DIR);
    expect(result).toBe(false);
  });

  it("returns false if no section exists", async () => {
    await writeFile(AGENTS_FILE, "# AGENTS.md\n\nNo section here.");
    const result = await removeOpnsrcSection(TEST_DIR);
    expect(result).toBe(false);
  });

  it("removes the opnsrc section", async () => {
    await writeFile(
      AGENTS_FILE,
      `# AGENTS.md\n\nBefore\n\n${SECTION_MARKER}\n\nSection content\n\n${SECTION_END_MARKER}\n\nAfter`,
    );

    const result = await removeOpnsrcSection(TEST_DIR);
    expect(result).toBe(true);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).toContain("Before");
    expect(content).toContain("After");
    expect(content).not.toContain(SECTION_MARKER);
    expect(content).not.toContain("Section content");
  });

  it("cleans up extra newlines", async () => {
    await writeFile(
      AGENTS_FILE,
      `# AGENTS.md\n\n\n\n${SECTION_MARKER}\n\nContent\n\n${SECTION_END_MARKER}\n\n\n\n`,
    );

    await removeOpnsrcSection(TEST_DIR);

    const content = await readFile(AGENTS_FILE, "utf-8");
    expect(content).not.toMatch(/\n{3,}/);
  });
});
