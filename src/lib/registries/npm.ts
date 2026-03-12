import { z } from "zod";
import type { ResolvedPackage } from "../../types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

const PackageInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  repository: z
    .object({
      type: z.string(),
      url: z.string(),
      directory: z.string().optional(),
    })
    .optional(),
});

const RegistryResponseSchema = z.object({
  name: z.string(),
  "dist-tags": z.object({ latest: z.string() }).passthrough(),
  versions: z.record(z.string(), PackageInfoSchema),
  repository: z
    .object({
      type: z.string(),
      url: z.string(),
      directory: z.string().optional(),
    })
    .optional(),
});

type RegistryResponse = z.infer<typeof RegistryResponseSchema>;

export function parseNpmSpec(spec: string): { readonly name: string; readonly version?: string } {
  if (spec.startsWith("@")) {
    const match = spec.match(/^(@[^/]+\/[^@]+)(?:@(.+))?$/);
    if (match) {
      return { name: match[1] ?? spec, version: match[2] };
    }
  }

  const atIndex = spec.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: spec.slice(0, atIndex), version: spec.slice(atIndex + 1) };
  }

  return { name: spec };
}

async function fetchNpmPackageInfo(packageName: string): Promise<RegistryResponse> {
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName).replace("%40", "@")}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "opnsrc-cli" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Package "${packageName}" not found on npm`);
    }
    throw new Error(`Failed to fetch package info: ${response.status} ${response.statusText}`);
  }

  return RegistryResponseSchema.parse(await response.json());
}

function extractRepoUrl(
  info: RegistryResponse,
  version?: string,
): { readonly url: string; readonly directory?: string } | null {
  const versionInfo = version ? info.versions[version] : null;
  const repo = versionInfo?.repository ?? info.repository;

  if (!repo?.url) return null;

  let url = repo.url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git\+ssh:\/\/git@/, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/\.git$/, "");

  if (url.startsWith("github:")) {
    url = `https://github.com/${url.slice(7)}`;
  }

  return { url, directory: repo.directory };
}

function getLatestVersion(info: RegistryResponse): string {
  return info["dist-tags"].latest;
}

export async function resolveNpmPackage(
  packageName: string,
  version?: string,
): Promise<ResolvedPackage> {
  const info = await fetchNpmPackageInfo(packageName);
  const resolvedVersion = version ?? getLatestVersion(info);

  if (!info.versions[resolvedVersion]) {
    const availableVersions = Object.keys(info.versions).slice(-5).join(", ");
    throw new Error(
      `Version "${resolvedVersion}" not found for "${packageName}". Recent versions: ${availableVersions}`,
    );
  }

  const repo = extractRepoUrl(info, resolvedVersion);

  if (!repo) {
    throw new Error(
      `No repository URL found for "${packageName}@${resolvedVersion}". This package may not have its source published.`,
    );
  }

  return {
    registry: "npm",
    name: packageName,
    version: resolvedVersion,
    repoUrl: repo.url,
    repoDirectory: repo.directory,
    gitTag: `v${resolvedVersion}`,
  };
}
