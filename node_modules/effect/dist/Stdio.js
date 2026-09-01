/**
 * Service contract for command-line arguments and standard input, output, and
 * error output. It lets programs depend on standard I/O through the Effect
 * environment instead of reading from or writing to global process handles
 * directly.
 *
 * The service exposes arguments as an `Effect`, stdout and stderr as `Sink`s
 * that accept strings or bytes, and stdin as a byte `Stream`. This module also
 * provides a constructor for service values and a small test layer with
 * overridable defaults.
 *
 * @since 4.0.0
 */
import * as Context from "./Context.js";
import * as Effect from "./Effect.js";
import * as Layer from "./Layer.js";
import * as Sink from "./Sink.js";
import * as Stream from "./Stream.js";
/**
 * Runtime identifier stored on `Stdio` service implementations.
 *
 * **Details**
 *
 * This marker is part of the runtime representation of `Stdio` service
 * implementations.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/Stdio";
/**
 * Service tag for process standard I/O.
 *
 * **When to use**
 *
 * Use when you need command-line arguments or standard I/O streams supplied by
 * an effect's environment.
 *
 * @see {@link make} for constructing a `Stdio` service directly
 * @see {@link layerTest} for a test layer with defaults and overrides
 *
 * @category services
 * @since 4.0.0
 */
export const Stdio = /*#__PURE__*/Context.Service(TypeId);
/**
 * Creates a `Stdio` service implementation from the provided fields and
 * attaches the `Stdio` type identifier.
 *
 * **When to use**
 *
 * Use when you need to assemble a concrete `Stdio` service from command-line
 * arguments and standard I/O implementations.
 *
 * **Details**
 *
 * The returned service reuses the supplied fields unchanged and only adds the
 * `Stdio` type identifier; it does not create a `Layer` or provide defaults.
 *
 * @see {@link layerTest} for a test layer with default fields that can be overridden
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = options => ({
  [TypeId]: TypeId,
  ...options
});
/**
 * Creates a test layer for `Stdio`.
 *
 * **When to use**
 *
 * Use to provide deterministic standard I/O in tests while overriding only the
 * command-line arguments, input stream, or output sinks relevant to the case.
 *
 * **Details**
 *
 * Any provided fields override defaults. By default, arguments are empty,
 * standard output and error are draining sinks, and standard input is an empty
 * stream.
 *
 * @see {@link make} for constructing a `Stdio` service directly without a `Layer` or defaults
 *
 * @category layers
 * @since 4.0.0
 */
export const layerTest = impl => Layer.succeed(Stdio, make({
  args: Effect.succeed([]),
  stdout: () => Sink.drain,
  stderr: () => Sink.drain,
  stdin: Stream.empty,
  ...impl
}));
//# sourceMappingURL=Stdio.js.map