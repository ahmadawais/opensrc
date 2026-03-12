import pc from "picocolors";
import {
  type PackageEntry,
  type RepoEntry,
  updateAgentsMd,
  updatePackageIndex,
} from "../lib/agents.js";
import {
  getPackageInfo,
  listSources,
  removePackageSource,
  removeRepoSource,
  repoExists,
} from "../lib/git.js";
import { detectRegistry } from "../lib/registries/index.js";
import { isRepoSpec } from "../lib/repo.js";
import { getFileModificationPermission } from "../lib/settings.js";
import type { Registry } from "../types.js";

export interface RemoveOptions {
  readonly cwd?: string;
}

export async function removeCommand(
  items: readonly string[],
  options: RemoveOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  let removed = 0;
  let notFound = 0;

  const removedPackages: Array<{ readonly name: string; readonly registry: Registry }> = [];
  const removedRepos: string[] = [];

  for (const item of items) {
    const isRepo = isRepoSpec(item) || (item.includes("/") && !item.includes(":"));

    if (isRepo) {
      let displayName = item;
      if (item.split("/").length === 2 && !item.startsWith("http")) {
        displayName = `github.com/${item}`;
      }

      if (!repoExists(displayName, cwd)) {
        if (repoExists(item, cwd)) {
          displayName = item;
        } else {
          console.log(pc.yellow(`  ⚠ ${item} not found`));
          notFound++;
          continue;
        }
      }

      const success = await removeRepoSource(displayName, cwd);

      if (success) {
        console.log(`${pc.green("  ✓")} Removed ${pc.white(displayName)}`);
        removed++;
        removedRepos.push(displayName);
      } else {
        console.log(pc.red(`  ✗ Failed to remove ${displayName}`));
      }
      continue;
    }

    const { registry, cleanSpec } = detectRegistry(item);
    let pkgInfo = await getPackageInfo(cleanSpec, cwd, registry);
    let actualRegistry = registry;

    if (!pkgInfo) {
      const registries: readonly Registry[] = ["npm", "pypi", "crates"];
      for (const reg of registries) {
        if (reg === registry) continue;
        pkgInfo = await getPackageInfo(cleanSpec, cwd, reg);
        if (pkgInfo) {
          actualRegistry = reg;
          break;
        }
      }
    }

    if (!pkgInfo) {
      console.log(pc.yellow(`  ⚠ ${cleanSpec} not found`));
      notFound++;
      continue;
    }

    const result = await removePackageSource(cleanSpec, cwd, actualRegistry);

    if (result.removed) {
      console.log(`${pc.green("  ✓")} Removed ${pc.white(cleanSpec)} (${actualRegistry})`);
      if (result.repoRemoved) {
        console.log(pc.gray("    → Also removed repo (no other packages use it)"));
      }
      removed++;
      removedPackages.push({ name: cleanSpec, registry: actualRegistry });
    } else {
      console.log(pc.red(`  ✗ Failed to remove ${cleanSpec}`));
    }
  }

  console.log(
    pc.gray(`\nRemoved ${removed} source(s)${notFound > 0 ? `, ${notFound} not found` : ""}`),
  );

  if (removed === 0) return;

  const sources = await listSources(cwd);
  const remainingPackages: PackageEntry[] = sources.packages.filter(
    (p) => !removedPackages.some((rp) => rp.name === p.name && rp.registry === p.registry),
  );
  const remainingRepos: RepoEntry[] = sources.repos.filter((r) => !removedRepos.includes(r.name));

  const canModifyFiles = await getFileModificationPermission(cwd);

  if (canModifyFiles) {
    const agentsUpdated = await updateAgentsMd(
      { packages: remainingPackages, repos: remainingRepos },
      cwd,
    );
    if (agentsUpdated) {
      const totalRemaining = remainingPackages.length + remainingRepos.length;
      if (totalRemaining === 0) {
        console.log(`${pc.green("✓")} Removed opnsrc section from AGENTS.md`);
      } else {
        console.log(`${pc.green("✓")} Updated AGENTS.md`);
      }
    }
    return;
  }

  await updatePackageIndex({ packages: remainingPackages, repos: remainingRepos }, cwd);
}
