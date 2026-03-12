# opnsrc

> Fetch source code for npm/PyPI/crates packages and GitHub repos to give AI coding agents deeper context.

```bash
npx opnsrc zod
npx opnsrc pypi:requests
npx opnsrc crates:serde
npx opnsrc vercel/ai
```

## Why

AI coding agents work better when they can read the actual source code of your dependencies — not just types and docs. `opnsrc` clones the source at the exact version you have installed and saves it in `opnsrc/` in your project.

## Install

```bash
npm install -g opnsrc
# or use without installing:
npx opnsrc <package>
```

## Usage

### Fetch source code

```bash
# npm packages (auto-detects installed version)
opnsrc zod
opnsrc react@18.2.0
opnsrc @types/node

# PyPI packages
opnsrc pypi:requests
opnsrc pypi:django==4.2.0

# crates.io packages
opnsrc crates:serde
opnsrc crates:tokio@1.35.0

# GitHub / GitLab repos
opnsrc vercel/ai
opnsrc github:facebook/react
opnsrc https://github.com/colinhacks/zod
opnsrc gitlab:owner/repo@main
```

### List fetched sources

```bash
opnsrc list
opnsrc list --json
```

### Remove sources

```bash
opnsrc remove zod
opnsrc remove pypi:requests
opnsrc remove vercel/ai
```

### Clean all sources

```bash
opnsrc clean              # removes everything
opnsrc clean --packages   # removes all packages only
opnsrc clean --repos      # removes all repos only
opnsrc clean --npm        # removes npm packages only
opnsrc clean --pypi       # removes PyPI packages only
opnsrc clean --crates     # removes crates.io packages only
```

## File Modifications

On first run, `opnsrc` asks whether it can update:

- `.gitignore` — adds `opnsrc/` to keep cloned sources out of git
- `tsconfig.json` — adds `opnsrc` to `exclude` array
- `AGENTS.md` — adds a section pointing agents to the source code

Your answer is saved to `opnsrc/settings.json`. Pass `--modify` or `--modify=false` to override.

## Options

| Flag | Description |
|------|-------------|
| `--cwd <path>` | Working directory (default: current directory) |
| `--modify` | Allow file modifications |
| `--modify=false` | Deny file modifications |
| `-v, --version` | Print version number |
| `-h, --help` | Display help |

## Storage Layout

```
opnsrc/
  sources.json          # index of all fetched sources
  settings.json         # user preferences
  repos/
    github.com/
      owner/
        repo/           # cloned source (no .git)
    gitlab.com/
      ...
```

## License

Apache-2.0
