import { z } from "zod";
import type { ResolvedPackage } from "../../types.js";

const PYPI_API = "https://pypi.org/pypi";

const PyPIReleaseSchema = z.object({
  upload_time: z.string(),
  yanked: z.boolean(),
});

const PyPIResponseSchema = z.object({
  info: z.object({
    name: z.string(),
    version: z.string(),
    home_page: z.string().optional(),
    project_urls: z.record(z.string(), z.string()).optional(),
    project_url: z.string().optional(),
  }),
  releases: z.record(z.string(), z.array(PyPIReleaseSchema)),
});

type PyPIResponse = z.infer<typeof PyPIResponseSchema>;

export function parsePyPISpec(spec: string): {
  readonly name: string;
  readonly version?: string;
} {
  const eqMatch = spec.match(/^([^=<>!~]+)==(.+)$/);
  if (eqMatch) {
    return { name: (eqMatch[1] ?? "").trim(), version: (eqMatch[2] ?? "").trim() };
  }

  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: spec.slice(0, atIndex).trim(), version: spec.slice(atIndex + 1).trim() };
  }

  return { name: spec.trim() };
}

async function fetchPyPIPackageInfo(packageName: string, version?: string): Promise<PyPIResponse> {
  const url = version
    ? `${PYPI_API}/${packageName}/${version}/json`
    : `${PYPI_API}/${packageName}/json`;

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "opnsrc-cli" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Package "${packageName}" not found on PyPI`);
    }
    throw new Error(`Failed to fetch package info: ${response.status} ${response.statusText}`);
  }

  return PyPIResponseSchema.parse(await response.json());
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

function extractRepoUrl(info: PyPIResponse["info"]): string | null {
  const projectUrls = info.project_urls ?? {};
  const repoKeys = ["Source", "Source Code", "Repository", "GitHub", "Code", "Homepage"];

  for (const key of repoKeys) {
    const url = projectUrls[key];
    if (url && isGitRepoUrl(url)) {
      return normalizeRepoUrl(url);
    }
  }

  if (info.home_page && isGitRepoUrl(info.home_page)) {
    return normalizeRepoUrl(info.home_page);
  }

  for (const url of Object.values(projectUrls)) {
    if (isGitRepoUrl(url)) {
      return normalizeRepoUrl(url);
    }
  }

  return null;
}

export async function resolvePyPIPackage(
  packageName: string,
  version?: string,
): Promise<ResolvedPackage> {
  const info = await fetchPyPIPackageInfo(packageName, version);
  const resolvedVersion = info.info.version;
  const repoUrl = extractRepoUrl(info.info);

  if (!repoUrl) {
    throw new Error(
      `No repository URL found for "${packageName}@${resolvedVersion}". This package may not have its source published.`,
    );
  }

  return {
    registry: "pypi",
    name: packageName,
    version: resolvedVersion,
    repoUrl,
    gitTag: `v${resolvedVersion}`,
  };
}
