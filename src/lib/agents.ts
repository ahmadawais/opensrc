import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { Registry } from "../types.js";

const AGENTS_FILE = "AGENTS.md";
const OPNSRC_DIR = "opnsrc";
const SOURCES_FILE = "sources.json";
const SECTION_START = "## Source Code Reference";
const SECTION_MARKER = "<!-- opnsrc:start -->";
const SECTION_END_MARKER = "<!-- opnsrc:end -->";

function getSectionContent(): string {
  return `${SECTION_MARKER}

${SECTION_START}

Source code for dependencies is available in \`opnsrc/\` for deeper understanding of implementation details.

See \`opnsrc/sources.json\` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

\`\`\`bash
npx opnsrc <package>           # npm package (e.g., npx opnsrc zod)
npx opnsrc pypi:<package>      # Python package (e.g., npx opnsrc pypi:requests)
npx opnsrc crates:<package>    # Rust crate (e.g., npx opnsrc crates:serde)
npx opnsrc <owner>/<repo>      # GitHub repo (e.g., npx opnsrc vercel/ai)
\`\`\`

${SECTION_END_MARKER}`;
}

export interface PackageEntry {
  readonly name: string;
  readonly version: string;
  readonly registry: Registry;
  readonly path: string;
  readonly fetchedAt: string;
}

export interface RepoEntry {
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly fetchedAt: string;
}

export interface SourcesIndex {
  readonly packages?: readonly PackageEntry[];
  readonly repos?: readonly RepoEntry[];
  readonly updatedAt: string;
}

export async function updatePackageIndex(
  sources: { readonly packages: readonly PackageEntry[]; readonly repos: readonly RepoEntry[] },
  cwd: string = process.cwd(),
): Promise<void> {
  const opnsrcDir = join(cwd, OPNSRC_DIR);
  const sourcesPath = join(opnsrcDir, SOURCES_FILE);

  if (sources.packages.length === 0 && sources.repos.length === 0) {
    if (existsSync(sourcesPath)) {
      const { rm } = await import("fs/promises");
      await rm(sourcesPath, { force: true });
    }
    return;
  }

  const index: SourcesIndex = {
    updatedAt: new Date().toISOString(),
    ...(sources.packages.length > 0 && { packages: sources.packages }),
    ...(sources.repos.length > 0 && { repos: sources.repos }),
  };

  await writeFile(sourcesPath, JSON.stringify(index, null, 2), "utf-8");
}

export async function hasOpnsrcSection(cwd: string = process.cwd()): Promise<boolean> {
  const agentsPath = join(cwd, AGENTS_FILE);

  if (!existsSync(agentsPath)) {
    return false;
  }

  try {
    const content = await readFile(agentsPath, "utf-8");
    return content.includes(SECTION_MARKER);
  } catch {
    return false;
  }
}

function extractSection(content: string): string | null {
  const startIdx = content.indexOf(SECTION_MARKER);
  const endIdx = content.indexOf(SECTION_END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    return null;
  }

  return content.slice(startIdx, endIdx + SECTION_END_MARKER.length);
}

export async function ensureAgentsMd(cwd: string = process.cwd()): Promise<boolean> {
  const agentsPath = join(cwd, AGENTS_FILE);
  const newSection = getSectionContent();

  if (!existsSync(agentsPath)) {
    const content = `# AGENTS.md

Instructions for AI coding agents working with this codebase.

${newSection}
`;
    await writeFile(agentsPath, content, "utf-8");
    return true;
  }

  const content = await readFile(agentsPath, "utf-8");

  if (!content.includes(SECTION_MARKER)) {
    let newContent = content;
    if (newContent.length > 0 && !newContent.endsWith("\n")) {
      newContent += "\n";
    }
    newContent += "\n" + newSection;
    await writeFile(agentsPath, newContent, "utf-8");
    return true;
  }

  const existingSection = extractSection(content);

  if (existingSection === newSection) {
    return false;
  }

  const startIdx = content.indexOf(SECTION_MARKER);
  const endIdx = content.indexOf(SECTION_END_MARKER);
  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + SECTION_END_MARKER.length);
  await writeFile(agentsPath, before + newSection + after, "utf-8");
  return true;
}

export async function updateAgentsMd(
  sources: { readonly packages: readonly PackageEntry[]; readonly repos: readonly RepoEntry[] },
  cwd: string = process.cwd(),
): Promise<boolean> {
  await updatePackageIndex(sources, cwd);

  if (sources.packages.length > 0 || sources.repos.length > 0) {
    return ensureAgentsMd(cwd);
  }

  return removeOpnsrcSection(cwd);
}

export async function removeOpnsrcSection(cwd: string = process.cwd()): Promise<boolean> {
  const agentsPath = join(cwd, AGENTS_FILE);

  if (!existsSync(agentsPath)) {
    return false;
  }

  try {
    const content = await readFile(agentsPath, "utf-8");

    if (!content.includes(SECTION_MARKER)) {
      return false;
    }

    const startIdx = content.indexOf(SECTION_MARKER);
    const endIdx = content.indexOf(SECTION_END_MARKER);

    if (startIdx === -1 || endIdx === -1) {
      return false;
    }

    const before = content.slice(0, startIdx).trimEnd();
    const after = content.slice(endIdx + SECTION_END_MARKER.length).trimStart();

    let newContent = before;
    if (after) {
      newContent += "\n\n" + after;
    }

    newContent = newContent.replace(/\n{3,}/g, "\n\n").trim() + "\n";
    await writeFile(agentsPath, newContent, "utf-8");
    return true;
  } catch {
    return false;
  }
}
