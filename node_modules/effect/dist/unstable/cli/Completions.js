/**
 * The `Completions` module turns a plain description of an Effect CLI command
 * tree into shell completion scripts for Bash, Zsh, and Fish. It is the
 * low-level script generation surface used by the unstable CLI package and by
 * the built-in completions global flag.
 *
 * @since 4.0.0
 */
import * as Bash from "./internal/completions/bash.js";
import * as Fish from "./internal/completions/fish.js";
import * as Zsh from "./internal/completions/zsh.js";
/**
 * Generates a shell completion script for a command descriptor.
 *
 * **When to use**
 *
 * Use when you need an installable completion script from an existing
 * `CommandDescriptor`.
 *
 * **Details**
 *
 * Dispatches by `shell` to Bash, Zsh, or Fish generation and returns a static
 * script string for `executableName`.
 *
 * @see {@link Shell} for supported shell names
 * @see {@link CommandDescriptor} for the command shape used by completion generation
 *
 * @category constructors
 * @since 4.0.0
 */
export const generate = (executableName, shell, descriptor) => {
  switch (shell) {
    case "bash":
      return Bash.generate(executableName, descriptor);
    case "zsh":
      return Zsh.generate(executableName, descriptor);
    case "fish":
      return Fish.generate(executableName, descriptor);
  }
};
//# sourceMappingURL=Completions.js.map