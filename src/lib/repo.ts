import { z } from "zod";
import type { RepoSpec, ResolvedRepo } from "../types.js";

const SUPPORTED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"] as const;
const DEFAULT_HOST = "github.com";

const GitHubApiResponseSchema = z
  .object({
    default_branch: z.string(),
  })
  .passthrough();

const GitLabApiResponseSchema = z
  .object({
    default_branch: z.string(),
  })
  .passthrough();

export function parseRepoSpec(spec: string): RepoSpec | null {
  let input = spec.trim();
  let ref: string | undefined;
  let host: string = DEFAULT_HOST;

  if (input.startsWith("github:")) {
    host = "github.com";
    input = input.slice(7);
  } else if (input.startsWith("gitlab:")) {
    host = "gitlab.com";
    input = input.slice(7);
  } else if (input.startsWith("bitbucket:")) {
    host = "bitbucket.org";
    input = input.slice(10);
  } else if (input.match(/^https?:\/\//)) {
    try {
      const url = new URL(input);
      host = url.hostname;
      const pathParts = url.pathname.slice(1).split("/").filter(Boolean);

      if (pathParts.length < 2) return null;

      const [owner, rawRepo] = pathParts as [string, string, ...string[]];
      let repo = rawRepo;

      if (repo.endsWith(".git")) {
        repo = repo.slice(0, -4);
      }

      if (pathParts.length >= 4 && (pathParts[2] === "tree" || pathParts[2] === "blob")) {
        ref = pathParts[3];
      }

      return { host, owner, repo, ref };
    } catch {
      return null;
    }
  } else if (SUPPORTED_HOSTS.some((h) => input.startsWith(`${h}/`))) {
    const firstSlash = input.indexOf("/");
    host = input.slice(0, firstSlash);
    input = input.slice(firstSlash + 1);
  } else if (input.startsWith("@")) {
    return null;
  } else if (input.split("/").length !== 2) {
    return null;
  }

  const atIndex = input.indexOf("@");
  const hashIndex = input.indexOf("#");

  if (atIndex > 0) {
    ref = input.slice(atIndex + 1);
    input = input.slice(0, atIndex);
  } else if (hashIndex > 0) {
    ref = input.slice(hashIndex + 1);
    input = input.slice(0, hashIndex);
  }

  const parts = input.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  return { host, owner: parts[0], repo: parts[1], ref };
}

export function isRepoSpec(spec: string): boolean {
  const trimmed = spec.trim();

  if (
    trimmed.startsWith("github:") ||
    trimmed.startsWith("gitlab:") ||
    trimmed.startsWith("bitbucket:")
  ) {
    return true;
  }

  if (trimmed.match(/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\//)) {
    return true;
  }

  if (SUPPORTED_HOSTS.some((h) => trimmed.startsWith(`${h}/`))) {
    return true;
  }

  if (trimmed.startsWith("@")) return false;

  const parts = trimmed.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    const repoPart = parts[1].split("@")[0]?.split("#")[0] ?? "";
    const validOwner = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(parts[0]);
    const validRepo = /^[a-zA-Z0-9._-]+$/.test(repoPart);
    return validOwner && validRepo;
  }

  return false;
}

async function resolveGitHubRepo(
  host: string,
  owner: string,
  repo: string,
  ref?: string,
): Promise<ResolvedRepo> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "opnsrc-cli",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Repository "${owner}/${repo}" not found on GitHub. Make sure it exists and is public.`,
      );
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Try again later or authenticate.");
    }
    throw new Error(`Failed to fetch repository info: ${response.status} ${response.statusText}`);
  }

  const data = GitHubApiResponseSchema.parse(await response.json());
  const resolvedRef = ref ?? data.default_branch;

  return {
    host,
    owner,
    repo,
    ref: resolvedRef,
    repoUrl: `https://github.com/${owner}/${repo}`,
    displayName: `${host}/${owner}/${repo}`,
  };
}

async function resolveGitLabRepo(
  host: string,
  owner: string,
  repo: string,
  ref?: string,
): Promise<ResolvedRepo> {
  const projectPath = encodeURIComponent(`${owner}/${repo}`);
  const apiUrl = `https://gitlab.com/api/v4/projects/${projectPath}`;

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "opnsrc-cli",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Repository "${owner}/${repo}" not found on GitLab. Make sure it exists and is public.`,
      );
    }
    throw new Error(`Failed to fetch repository info: ${response.status} ${response.statusText}`);
  }

  const data = GitLabApiResponseSchema.parse(await response.json());
  const resolvedRef = ref ?? data.default_branch;

  return {
    host,
    owner,
    repo,
    ref: resolvedRef,
    repoUrl: `https://gitlab.com/${owner}/${repo}`,
    displayName: `${host}/${owner}/${repo}`,
  };
}

export async function resolveRepo(spec: RepoSpec): Promise<ResolvedRepo> {
  const { host, owner, repo, ref } = spec;

  if (host === "github.com") {
    return resolveGitHubRepo(host, owner, repo, ref);
  }

  if (host === "gitlab.com") {
    return resolveGitLabRepo(host, owner, repo, ref);
  }

  return {
    host,
    owner,
    repo,
    ref: ref ?? "main",
    repoUrl: `https://${host}/${owner}/${repo}`,
    displayName: `${host}/${owner}/${repo}`,
  };
}

export function displayNameToSpec(
  displayName: string,
): { readonly host: string; readonly owner: string; readonly repo: string } | null {
  const parts = displayName.split("/");
  if (parts.length !== 3) return null;
  const [host, owner, repo] = parts;
  if (!host || !owner || !repo) return null;
  return { host, owner, repo };
}

export function displayNameToOwnerRepo(
  displayName: string,
): { readonly owner: string; readonly repo: string } | null {
  if (displayName.includes("--") && !displayName.includes("/")) {
    const parts = displayName.split("--");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  }

  const spec = displayNameToSpec(displayName);
  if (!spec) return null;
  return { owner: spec.owner, repo: spec.repo };
}
