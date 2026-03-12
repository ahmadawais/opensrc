import type { Registry, PackageSpec, ResolvedPackage } from "../../types.js";
import { parseNpmSpec, resolveNpmPackage } from "./npm.js";
import { parsePyPISpec, resolvePyPIPackage } from "./pypi.js";
import { parseCratesSpec, resolveCrate } from "./crates.js";
import { isRepoSpec } from "../repo.js";

export { resolveNpmPackage } from "./npm.js";
export { resolvePyPIPackage } from "./pypi.js";
export { resolveCrate } from "./crates.js";

const REGISTRY_PREFIXES: Readonly<Record<string, Registry>> = {
  "npm:": "npm",
  "pypi:": "pypi",
  "pip:": "pypi",
  "python:": "pypi",
  "crates:": "crates",
  "cargo:": "crates",
  "rust:": "crates",
};

export function detectRegistry(spec: string): {
  readonly registry: Registry;
  readonly cleanSpec: string;
} {
  const trimmed = spec.trim();

  for (const [prefix, registry] of Object.entries(REGISTRY_PREFIXES)) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return { registry, cleanSpec: trimmed.slice(prefix.length) };
    }
  }

  return { registry: "npm", cleanSpec: trimmed };
}

export function parsePackageSpec(spec: string): PackageSpec {
  const { registry, cleanSpec } = detectRegistry(spec);

  if (registry === "npm") {
    const { name, version } = parseNpmSpec(cleanSpec);
    return { registry, name, version };
  }

  if (registry === "pypi") {
    const { name, version } = parsePyPISpec(cleanSpec);
    return { registry, name, version };
  }

  const { name, version } = parseCratesSpec(cleanSpec);
  return { registry, name, version };
}

export async function resolvePackage(spec: PackageSpec): Promise<ResolvedPackage> {
  const { registry, name, version } = spec;

  if (registry === "npm") return resolveNpmPackage(name, version);
  if (registry === "pypi") return resolvePyPIPackage(name, version);
  return resolveCrate(name, version);
}

export function detectInputType(spec: string): "package" | "repo" {
  const trimmed = spec.trim();

  for (const prefix of Object.keys(REGISTRY_PREFIXES)) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return "package";
    }
  }

  if (isRepoSpec(trimmed)) return "repo";
  return "package";
}
