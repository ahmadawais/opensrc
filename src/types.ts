import { z } from "zod";

export const RegistrySchema = z.enum(["npm", "pypi", "crates"]);
export type Registry = z.infer<typeof RegistrySchema>;

export type PackageName = string & { readonly __brand: "PackageName" };
export type PackageVersion = string & { readonly __brand: "PackageVersion" };

export const PackageSpecSchema = z.object({
  registry: RegistrySchema,
  name: z.string(),
  version: z.string().optional(),
});
export type PackageSpec = z.infer<typeof PackageSpecSchema>;

export const ResolvedPackageSchema = z.object({
  registry: RegistrySchema,
  name: z.string(),
  version: z.string(),
  repoUrl: z.string().url(),
  repoDirectory: z.string().optional(),
  gitTag: z.string(),
});
export type ResolvedPackage = z.infer<typeof ResolvedPackageSchema>;

export const FetchResultSchema = z.object({
  package: z.string(),
  version: z.string(),
  path: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  registry: RegistrySchema.optional(),
});
export type FetchResult = z.infer<typeof FetchResultSchema>;

export const InstalledPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});
export type InstalledPackage = z.infer<typeof InstalledPackageSchema>;

export const RepoSpecSchema = z.object({
  host: z.string(),
  owner: z.string(),
  repo: z.string(),
  ref: z.string().optional(),
});
export type RepoSpec = z.infer<typeof RepoSpecSchema>;

export const ResolvedRepoSchema = z.object({
  host: z.string(),
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
  repoUrl: z.string().url(),
  displayName: z.string(),
});
export type ResolvedRepo = z.infer<typeof ResolvedRepoSchema>;

export type InputType = "package" | "repo";
