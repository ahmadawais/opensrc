import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const OPNSRC_ENTRY = "opnsrc/";
const MARKER_COMMENT = "# opnsrc - source code for packages";

export async function hasOpnsrcEntry(cwd: string = process.cwd()): Promise<boolean> {
  const gitignorePath = join(cwd, ".gitignore");

  if (!existsSync(gitignorePath)) {
    return false;
  }

  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    return lines.some((line) => {
      const trimmed = line.trim();
      return trimmed === OPNSRC_ENTRY || trimmed === "opnsrc";
    });
  } catch {
    return false;
  }
}

export async function ensureGitignore(cwd: string = process.cwd()): Promise<boolean> {
  const gitignorePath = join(cwd, ".gitignore");

  if (await hasOpnsrcEntry(cwd)) {
    return false;
  }

  let content = "";

  if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, "utf-8");
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    if (content.trim().length > 0) {
      content += "\n";
    }
  }

  content += `${MARKER_COMMENT}\n${OPNSRC_ENTRY}\n`;
  await writeFile(gitignorePath, content, "utf-8");
  return true;
}

export async function removeFromGitignore(cwd: string = process.cwd()): Promise<boolean> {
  const gitignorePath = join(cwd, ".gitignore");

  if (!existsSync(gitignorePath)) {
    return false;
  }

  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");

    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed !== OPNSRC_ENTRY && trimmed !== "opnsrc" && trimmed !== MARKER_COMMENT;
    });

    const cleaned: string[] = [];
    let prevWasBlank = false;
    for (const line of filtered) {
      const isBlank = line.trim() === "";
      if (isBlank && prevWasBlank) continue;
      cleaned.push(line);
      prevWasBlank = isBlank;
    }

    const newContent = cleaned.join("\n");
    if (newContent === content) return false;

    await writeFile(gitignorePath, newContent, "utf-8");
    return true;
  } catch {
    return false;
  }
}
