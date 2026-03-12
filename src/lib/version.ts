import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { InstalledPackage } from "../types.js";

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

interface PackageLockJson {
  readonly packages?: Readonly<Record<string, { readonly version?: string }>>;
  readonly dependencies?: Readonly<Record<string, { readonly version: string }>>;
}

function stripVersionPrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

async function getVersionFromNodeModules(
  packageName: string,
  cwd: string,
): Promise<string | null> {
  const pkgPath = join(cwd, "node_modules", packageName, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

async function getVersionFromPackageLock(
  packageName: string,
  cwd: string,
): Promise<string | null> {
  const lockPath = join(cwd, "package-lock.json");
  if (!existsSync(lockPath)) return null;

  try {
    const content = await readFile(lockPath, "utf-8");
    const lock = JSON.parse(content) as PackageLockJson;

    const key = `node_modules/${packageName}`;
    if (lock.packages?.[key]?.version) {
      return lock.packages[key]?.version ?? null;
    }

    if (lock.dependencies?.[packageName]?.version) {
      return lock.dependencies[packageName]?.version ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

async function getVersionFromPnpmLock(
  packageName: string,
  cwd: string,
): Promise<string | null> {
  const lockPath = join(cwd, "pnpm-lock.yaml");
  if (!existsSync(lockPath)) return null;

  try {
    const content = await readFile(lockPath, "utf-8");
    const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`['"]?${escapedName}@([^(':"\\s)]+)`, "g");
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      return matches[0]?.[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getVersionFromYarnLock(
  packageName: string,
  cwd: string,
): Promise<string | null> {
  const lockPath = join(cwd, "yarn.lock");
  if (!existsSync(lockPath)) return null;

  try {
    const content = await readFile(lockPath, "utf-8");
    const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `"?${escapedName}@[^":\\n]+[":]?\\s*\\n\\s*version\\s+["']?([^"'\\n]+)`,
      "g",
    );
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      return matches[0]?.[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getVersionFromPackageJson(
  packageName: string,
  cwd: string,
): Promise<string | null> {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as PackageJson;
    const version =
      pkg.dependencies?.[packageName] ??
      pkg.devDependencies?.[packageName] ??
      pkg.peerDependencies?.[packageName];

    if (version) return stripVersionPrefix(version);
    return null;
  } catch {
    return null;
  }
}

export async function detectInstalledVersion(
  packageName: string,
  cwd: string = process.cwd(),
): Promise<string | null> {
  const fromNodeModules = await getVersionFromNodeModules(packageName, cwd);
  if (fromNodeModules) return fromNodeModules;

  const fromPackageLock = await getVersionFromPackageLock(packageName, cwd);
  if (fromPackageLock) return fromPackageLock;

  const fromPnpmLock = await getVersionFromPnpmLock(packageName, cwd);
  if (fromPnpmLock) return fromPnpmLock;

  const fromYarnLock = await getVersionFromYarnLock(packageName, cwd);
  if (fromYarnLock) return fromYarnLock;

  const fromPackageJson = await getVersionFromPackageJson(packageName, cwd);
  if (fromPackageJson) return fromPackageJson;

  return null;
}

export async function listDependencies(
  cwd: string = process.cwd(),
): Promise<readonly InstalledPackage[]> {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return [];

  try {
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as PackageJson;
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    return Object.entries(allDeps).map(([name, version]) => ({
      name,
      version: stripVersionPrefix(version),
    }));
  } catch {
    return [];
  }
}
