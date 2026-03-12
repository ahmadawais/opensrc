import { z } from "zod";
import type { ResolvedPackage } from "../../types.js";

const CRATES_API = "https://crates.io/api/v1";
const USER_AGENT = "opnsrc-cli (https://github.com/ahmadawais/opnsrc)";

const CrateVersionSchema = z.object({
  num: z.string(),
  yanked: z.boolean(),
  created_at: z.string(),
});

const CrateResponseSchema = z.object({
  crate: z.object({
    id: z.string(),
    name: z.string(),
    max_version: z.string(),
    repository: z.string().optional(),
    homepage: z.string().optional(),
  }),
  versions: z.array(CrateVersionSchema),
});

const CrateVersionResponseSchema = z.object({
  version: z.object({
    num: z.string(),
    crate: z.string(),
    yanked: z.boolean(),
  }),
});

type CrateResponse = z.infer<typeof CrateResponseSchema>;

export function parseCratesSpec(spec: string): {
  readonly name: string;
  readonly version?: string;
} {
  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: spec.slice(0, atIndex).trim(), version: spec.slice(atIndex + 1).trim() };
  }
  return { name: spec.trim() };
}

async function fetchCrateInfo(crateName: string): Promise<CrateResponse> {
  const url = `${CRATES_API}/crates/${crateName}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Crate "${crateName}" not found on crates.io`);
    }
    throw new Error(`Failed to fetch crate info: ${response.status} ${response.statusText}`);
  }

  return CrateResponseSchema.parse(await response.json());
}

async function fetchCrateVersionInfo(crateName: string, version: string): Promise<void> {
  const url = `${CRATES_API}/crates/${crateName}/${version}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Version "${version}" not found for crate "${crateName}"`);
    }
    throw new Error(
      `Failed to fetch crate version info: ${response.status} ${response.statusText}`,
    );
  }

  CrateVersionResponseSchema.parse(await response.json());
}

const GIT_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"] as const;

function isGitRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return GIT_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function normalizeRepoUrl(url: string): string {
  return url
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .replace(/\/tree\/.*$/, "")
    .replace(/\/blob\/.*$/, "");
}

function extractRepoUrl(crate: CrateResponse["crate"]): string | null {
  if (crate.repository && isGitRepoUrl(crate.repository)) {
    return normalizeRepoUrl(crate.repository);
  }

  if (crate.homepage && isGitRepoUrl(crate.homepage)) {
    return normalizeRepoUrl(crate.homepage);
  }

  return null;
}

export async function resolveCrate(crateName: string, version?: string): Promise<ResolvedPackage> {
  const info = await fetchCrateInfo(crateName);
  let resolvedVersion = version ?? info.crate.max_version;

  if (version) {
    await fetchCrateVersionInfo(crateName, version);
    resolvedVersion = version;
  }

  const repoUrl = extractRepoUrl(info.crate);

  if (!repoUrl) {
    const availableVersions = info.versions
      .filter((v) => !v.yanked)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((v) => v.num)
      .join(", ");

    throw new Error(
      `No repository URL found for "${crateName}@${resolvedVersion}". This crate may not have its source published. Recent versions: ${availableVersions}`,
    );
  }

  return {
    registry: "crates",
    name: crateName,
    version: resolvedVersion,
    repoUrl,
    gitTag: `v${resolvedVersion}`,
  };
}
