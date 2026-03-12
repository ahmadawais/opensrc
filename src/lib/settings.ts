import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const OPNSRC_DIR = "opnsrc";
const SETTINGS_FILE = "settings.json";

const OpnsrcSettingsSchema = z.object({
  allowFileModifications: z.boolean().optional(),
});
export type OpnsrcSettings = z.infer<typeof OpnsrcSettingsSchema>;

function getSettingsPath(cwd: string): string {
  return join(cwd, OPNSRC_DIR, SETTINGS_FILE);
}

async function ensureOpnsrcDir(cwd: string): Promise<void> {
  const dir = join(cwd, OPNSRC_DIR);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function readSettings(cwd: string = process.cwd()): Promise<OpnsrcSettings> {
  const settingsPath = getSettingsPath(cwd);

  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    const content = await readFile(settingsPath, "utf-8");
    const parsed = OpnsrcSettingsSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return {};
    return parsed.data;
  } catch {
    return {};
  }
}

export async function writeSettings(
  settings: OpnsrcSettings,
  cwd: string = process.cwd(),
): Promise<void> {
  await ensureOpnsrcDir(cwd);
  const settingsPath = getSettingsPath(cwd);
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

export async function getFileModificationPermission(
  cwd: string = process.cwd(),
): Promise<boolean | undefined> {
  const settings = await readSettings(cwd);
  return settings.allowFileModifications;
}

export async function setFileModificationPermission(
  allowed: boolean,
  cwd: string = process.cwd(),
): Promise<void> {
  const settings = await readSettings(cwd);
  settings.allowFileModifications = allowed;
  await writeSettings(settings, cwd);
}
