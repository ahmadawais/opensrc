import ora from "ora";
import pc from "picocolors";
import {
  detectInputType,
  parsePackageSpec,
  resolvePackage,
} from "../lib/registries/index.js";
import { parseRepoSpec, resolveRepo } from "../lib/repo.js";
import { detectInstalledVersion } from "../lib/version.js";
import {
  fetchSource,
  fetchRepoSource,
  repoExists,
  packageRepoExists,
  listSources,
  getPackageInfo,
  getRepoInfo,
  getRepoRelativePath,
  getRepoDisplayName,
} from "../lib/git.js";
import { ensureGitignore } from "../lib/gitignore.js";
import { ensureTsconfigExclude } from "../lib/tsconfig.js";
import {
  updateAgentsMd,
  updatePackageIndex,
  type PackageEntry,
  type RepoEntry,
} from "../lib/agents.js";
import {
  getFileModificationPermission,
  setFileModificationPermission,
} from "../lib/settings.js";
import { confirm } from "../lib/prompt.js";
import type { FetchResult, Registry } from "../types.js";

export interface FetchOptions {
  readonly cwd?: string;
  readonly allowModifications?: boolean;
}

function getRegistryLabel(registry: Registry): string {
  if (registry === "npm") return "npm";
  if (registry === "pypi") return "PyPI";
  return "crates.io";
}

async function checkFileModificationPermission(
  cwd: string,
  cliOverride?: boolean,
): Promise<boolean> {
  if (cliOverride !== undefined) {
    await setFileModificationPermission(cliOverride, cwd);
    if (cliOverride) {
      console.log(pc.green("✓") + " File modifications enabled (--modify)");
    } else {
      console.log(pc.red("✗") + " File modifications disabled (--modify=false)");
    }
    return cliOverride;
  }

  const storedPermission = await getFileModificationPermission(cwd);
  if (storedPermission !== undefined) return storedPermission;

  console.log(pc.gray("\nopnsrc can update the following files for better integration:"));
  console.log(pc.gray("  • .gitignore - add opnsrc/ to ignore list"));
  console.log(pc.gray("  • tsconfig.json - exclude opnsrc/ from compilation"));
  console.log(pc.gray("  • AGENTS.md - add source code reference section\n"));

  const allowed = await confirm("Allow opnsrc to modify these files?");
  await setFileModificationPermission(allowed, cwd);

  if (allowed) {
    console.log(pc.green("✓") + " Permission granted - saved to opnsrc/settings.json\n");
  } else {
    console.log(pc.red("✗") + " Permission denied - saved to opnsrc/settings.json\n");
  }

  return allowed;
}

async function fetchRepoInput(spec: string, cwd: string): Promise<FetchResult> {
  const repoSpec = parseRepoSpec(spec);

  if (!repoSpec) {
    return { package: spec, version: "", path: "", success: false, error: `Invalid repository format: ${spec}` };
  }

  const displayName = `${repoSpec.host}/${repoSpec.owner}/${repoSpec.repo}`;
  const spinner = ora(`Fetching ${pc.white(repoSpec.owner + "/" + repoSpec.repo)} from ${repoSpec.host}`).start();

  try {
    if (repoExists(displayName, cwd)) {
      const existing = await getRepoInfo(displayName, cwd);
      if (existing && repoSpec.ref && existing.version === repoSpec.ref) {
        spinner.succeed(`Already up to date (${repoSpec.ref})`);
        return { package: displayName, version: existing.version, path: getRepoRelativePath(displayName), success: true };
      }
    }

    spinner.text = `Resolving ${pc.white(repoSpec.owner + "/" + repoSpec.repo)}...`;
    const resolved = await resolveRepo(repoSpec);
    spinner.text = `Cloning at ${pc.white(resolved.ref)}...`;
    const result = await fetchRepoSource(resolved, cwd);

    if (result.success) {
      spinner.succeed(`Saved to ${pc.gray("opnsrc/" + result.path)}`);
      if (result.error) console.log(pc.yellow("  ⚠ " + result.error));
    } else {
      spinner.fail(`Failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    spinner.fail(`Error: ${errorMessage}`);
    return { package: displayName, version: "", path: "", success: false, error: errorMessage };
  }
}

async function fetchPackageInput(spec: string, cwd: string): Promise<FetchResult> {
  const packageSpec = parsePackageSpec(spec);
  const { registry, name } = packageSpec;
  let { version } = packageSpec;

  const registryLabel = getRegistryLabel(registry);
  const spinner = ora(`Fetching ${pc.white(name)} from ${registryLabel}`).start();

  try {
    if (!version && registry === "npm") {
      const installedVersion = await detectInstalledVersion(name, cwd);
      if (installedVersion) {
        version = installedVersion;
        spinner.text = `Fetching ${pc.white(name)}@${pc.gray(version)} from ${registryLabel}`;
      }
    }

    const existingPkg = await getPackageInfo(name, cwd, registry);
    if (existingPkg && existingPkg.version === version) {
      spinner.succeed(`Already up to date (${existingPkg.version})`);
      return { package: name, version: existingPkg.version, path: existingPkg.path, success: true, registry };
    }

    spinner.text = `Resolving ${pc.white(name)}...`;
    const resolved = await resolvePackage({ registry, name, version });

    if (packageRepoExists(resolved.repoUrl, cwd)) {
      spinner.text = `Checking version for ${pc.white(name)}...`;
    }

    spinner.text = `Cloning at ${pc.white(resolved.gitTag)}...`;
    const result = await fetchSource(resolved, cwd);

    if (result.success) {
      spinner.succeed(`Saved to ${pc.gray("opnsrc/" + result.path)}`);
      if (result.error) console.log(pc.yellow("  ⚠ " + result.error));
    } else {
      spinner.fail(`Failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    spinner.fail(`Error: ${errorMessage}`);
    return { package: name, version: "", path: "", success: false, error: errorMessage, registry };
  }
}

function mergeResults(
  existing: { readonly packages: readonly PackageEntry[]; readonly repos: readonly RepoEntry[] },
  results: readonly FetchResult[],
): { packages: PackageEntry[]; repos: RepoEntry[] } {
  const now = new Date().toISOString();
  const packages: PackageEntry[] = [...existing.packages];
  const repos: RepoEntry[] = [...existing.repos];

  for (const result of results) {
    if (!result.success) continue;

    if (result.registry) {
      const idx = packages.findIndex(
        (p) => p.name === result.package && p.registry === result.registry,
      );
      const entry: PackageEntry = {
        name: result.package,
        version: result.version,
        registry: result.registry,
        path: result.path,
        fetchedAt: now,
      };
      if (idx >= 0) {
        packages[idx] = entry;
      } else {
        packages.push(entry);
      }
    } else {
      const idx = repos.findIndex((r) => r.name === result.package);
      const entry: RepoEntry = {
        name: result.package,
        version: result.version,
        path: result.path,
        fetchedAt: now,
      };
      if (idx >= 0) {
        repos[idx] = entry;
      } else {
        repos.push(entry);
      }
    }
  }

  return { packages, repos };
}

export async function fetchCommand(
  packages: readonly string[],
  options: FetchOptions = {},
): Promise<readonly FetchResult[]> {
  const cwd = options.cwd ?? process.cwd();
  const results: FetchResult[] = [];

  const canModifyFiles = await checkFileModificationPermission(cwd, options.allowModifications);

  if (canModifyFiles) {
    const gitignoreUpdated = await ensureGitignore(cwd);
    if (gitignoreUpdated) console.log(pc.green("✓") + " Added opnsrc/ to .gitignore");

    const tsconfigUpdated = await ensureTsconfigExclude(cwd);
    if (tsconfigUpdated) console.log(pc.green("✓") + " Added opnsrc/ to tsconfig.json exclude");
  }

  for (const spec of packages) {
    const inputType = detectInputType(spec);

    if (inputType === "repo") {
      const result = await fetchRepoInput(spec, cwd);
      results.push(result);
    } else {
      const result = await fetchPackageInput(spec, cwd);
      results.push(result);
    }
  }

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(
    `\n${pc.white("Done:")} ${pc.green(String(successful.length) + " succeeded")}, ${pc.red(String(failed.length) + " failed")}`,
  );

  if (successful.length > 0) {
    console.log(pc.gray("\nSource code available at:"));
    for (const result of successful) {
      console.log(pc.gray(`  ${result.package} → opnsrc/${result.path}`));
    }
  }

  if (successful.length > 0) {
    const existingSources = await listSources(cwd);
    const mergedSources = mergeResults(existingSources, results);

    if (canModifyFiles) {
      const agentsUpdated = await updateAgentsMd(mergedSources, cwd);
      if (agentsUpdated) console.log(pc.green("✓") + " Updated AGENTS.md");
    } else {
      await updatePackageIndex(mergedSources, cwd);
    }
  }

  return results;
}
