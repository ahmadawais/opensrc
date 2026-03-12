import pc from "picocolors";
import { listSources } from "../lib/git.js";
import type { Registry } from "../types.js";

export interface ListOptions {
  readonly cwd?: string;
  readonly json?: boolean;
}

const REGISTRY_LABELS: Readonly<Record<Registry, string>> = {
  npm: "npm",
  pypi: "PyPI",
  crates: "crates.io",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export async function listCommand(options: ListOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const sources = await listSources(cwd);
  const totalCount = sources.packages.length + sources.repos.length;

  if (totalCount === 0) {
    console.log(pc.gray("No sources fetched yet."));
    console.log(pc.gray("\nUse `opnsrc <package>` to fetch source code for a package."));
    console.log(pc.gray("Use `opnsrc <owner>/<repo>` to fetch a GitHub repository."));
    console.log(pc.gray("\nSupported registries:"));
    console.log(pc.gray("  • npm:      opnsrc zod, opnsrc npm:react"));
    console.log(pc.gray("  • PyPI:     opnsrc pypi:requests"));
    console.log(pc.gray("  • crates:   opnsrc crates:serde"));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(sources, null, 2));
    return;
  }

  const packagesByRegistry: Record<Registry, Array<{ name: string; version: string; registry: Registry; path: string; fetchedAt: string }>> = {
    npm: [],
    pypi: [],
    crates: [],
  };

  for (const pkg of sources.packages) {
    packagesByRegistry[pkg.registry].push(pkg);
  }

  const registries: readonly Registry[] = ["npm", "pypi", "crates"];
  let hasDisplayedPackages = false;

  for (const registry of registries) {
    const packages = packagesByRegistry[registry];
    if (packages.length === 0) continue;

    if (hasDisplayedPackages) console.log("");

    console.log(pc.white(`${REGISTRY_LABELS[registry]} Packages:\n`));
    hasDisplayedPackages = true;

    for (const source of packages) {
      console.log(`  ${pc.white(source.name + "@" + source.version)}`);
      console.log(pc.gray(`    Path: opnsrc/${source.path}`));
      console.log(pc.gray(`    Fetched: ${formatDate(source.fetchedAt)}`));
      console.log("");
    }
  }

  if (sources.repos.length > 0) {
    if (hasDisplayedPackages) console.log("");
    console.log(pc.white("Repositories:\n"));

    for (const source of sources.repos) {
      console.log(`  ${pc.white(source.name + "@" + source.version)}`);
      console.log(pc.gray(`    Path: opnsrc/${source.path}`));
      console.log(pc.gray(`    Fetched: ${formatDate(source.fetchedAt)}`));
      console.log("");
    }
  }

  const registryCounts = registries
    .map((reg) => {
      const count = packagesByRegistry[reg].length;
      return count > 0 ? `${count} ${REGISTRY_LABELS[reg]}` : null;
    })
    .filter(Boolean)
    .join(", ");

  const summary = [
    registryCounts ? `${sources.packages.length} package(s) (${registryCounts})` : null,
    sources.repos.length > 0 ? `${sources.repos.length} repo(s)` : null,
  ]
    .filter(Boolean)
    .join(", ");

  console.log(pc.gray(`Total: ${summary}`));
}
