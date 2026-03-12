import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./commands/fetch.js", () => ({ fetchCommand: vi.fn() }));
vi.mock("./commands/list.js", () => ({ listCommand: vi.fn() }));
vi.mock("./commands/remove.js", () => ({ removeCommand: vi.fn() }));
vi.mock("./commands/clean.js", () => ({ cleanCommand: vi.fn() }));

import { cleanCommand } from "./commands/clean.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { createProgram } from "./index.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CLI --cwd routing", () => {
  it("passes --cwd to list subcommand", async () => {
    const program = createProgram();
    await program.parseAsync(["node", "opnsrc", "list", "--cwd", "/tmp/foo"]);
    expect(listCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: "/tmp/foo" }));
  });

  it("passes --cwd to remove subcommand", async () => {
    const program = createProgram();
    await program.parseAsync(["node", "opnsrc", "remove", "zod", "--cwd", "/tmp/bar"]);
    expect(removeCommand).toHaveBeenCalledWith(
      ["zod"],
      expect.objectContaining({ cwd: "/tmp/bar" }),
    );
  });

  it("passes --cwd to clean subcommand", async () => {
    const program = createProgram();
    await program.parseAsync(["node", "opnsrc", "clean", "--cwd", "/tmp/baz"]);
    expect(cleanCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: "/tmp/baz" }));
  });
});
