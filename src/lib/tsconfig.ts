import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const OPNSRC_DIR = "opnsrc";

const TsConfigSchema = z
  .object({
    exclude: z.array(z.string()).optional(),
  })
  .passthrough();

type TsConfig = z.infer<typeof TsConfigSchema>;

export function hasTsConfig(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, "tsconfig.json"));
}

export async function hasOpnsrcExclude(cwd: string = process.cwd()): Promise<boolean> {
  const tsconfigPath = join(cwd, "tsconfig.json");

  if (!existsSync(tsconfigPath)) {
    return false;
  }

  try {
    const content = await readFile(tsconfigPath, "utf-8");
    const parsed = TsConfigSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return false;

    const exclude = parsed.data.exclude;
    if (!exclude) return false;

    return exclude.some(
      (entry) => entry === OPNSRC_DIR || entry === `${OPNSRC_DIR}/` || entry === `./${OPNSRC_DIR}`,
    );
  } catch {
    return false;
  }
}

export async function ensureTsconfigExclude(cwd: string = process.cwd()): Promise<boolean> {
  const tsconfigPath = join(cwd, "tsconfig.json");

  if (!existsSync(tsconfigPath)) {
    return false;
  }

  if (await hasOpnsrcExclude(cwd)) {
    return false;
  }

  try {
    const content = await readFile(tsconfigPath, "utf-8");
    const parsed = TsConfigSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return false;

    const config: TsConfig = parsed.data;
    const exclude = config.exclude ? [...config.exclude, OPNSRC_DIR] : [OPNSRC_DIR];
    const updated = { ...config, exclude };

    await writeFile(tsconfigPath, `${JSON.stringify(updated, null, 2)}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
