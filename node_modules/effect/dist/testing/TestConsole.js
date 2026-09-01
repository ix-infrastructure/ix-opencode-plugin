/**
 * Provides a test implementation of the Effect `Console` service.
 *
 * When the test layer is provided, calls made through the Effect console APIs
 * are captured in memory instead of being written to the host console. Tests can
 * then assert on logged values deterministically. This module includes the
 * console layer, helpers for reading captured `Console.log` and `Console.error`
 * arguments, and access to the provided test console service.
 *
 * @since 4.0.0
 */
import * as Array from "../Array.js";
import * as Console from "../Console.js";
import * as Effect from "../Effect.js";
import * as Layer from "../Layer.js";
/**
 * Creates a new TestConsole instance that captures all console output.
 * The returned TestConsole implements the Console interface and provides
 * additional methods to retrieve logged messages.
 *
 * **When to use**
 *
 * Use to construct a test console service value directly.
 *
 * **Example** (Creating a test console)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { TestConsole } from "effect/testing"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("Debug message")
 *   yield* Console.error("Error occurred")
 *
 *   const logs = yield* TestConsole.logLines
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log("Captured logs:", logs)
 *   console.log("Captured errors:", errors)
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @see {@link layer} for providing a `TestConsole` as a `Layer`
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = /*#__PURE__*/Effect.gen(function* () {
  const entries = [];
  function createEntryUnsafe(method) {
    return (...parameters) => {
      entries.push({
        method,
        parameters
      });
    };
  }
  const logLines = Effect.sync(() => Array.flatMap(entries, entry => entry.method === "log" ? entry.parameters : []));
  const errorLines = Effect.sync(() => Array.flatMap(entries, entry => entry.method === "error" ? entry.parameters : []));
  return {
    assert: createEntryUnsafe("assert"),
    clear: createEntryUnsafe("clear"),
    count: createEntryUnsafe("count"),
    countReset: createEntryUnsafe("countReset"),
    debug: createEntryUnsafe("debug"),
    dir: createEntryUnsafe("dir"),
    dirxml: createEntryUnsafe("dirxml"),
    error: createEntryUnsafe("error"),
    group: createEntryUnsafe("group"),
    groupCollapsed: createEntryUnsafe("groupCollapsed"),
    groupEnd: createEntryUnsafe("groupEnd"),
    info: createEntryUnsafe("info"),
    log: createEntryUnsafe("log"),
    table: createEntryUnsafe("table"),
    time: createEntryUnsafe("time"),
    timeEnd: createEntryUnsafe("timeEnd"),
    timeLog: createEntryUnsafe("timeLog"),
    trace: createEntryUnsafe("trace"),
    warn: createEntryUnsafe("warn"),
    logLines,
    errorLines
  };
});
/**
 * Retrieves the `TestConsole` service for this test and uses it to run the
 * specified workflow.
 *
 * **When to use**
 *
 * Use to access the provided test console service inside an effect.
 *
 * **Example** (Accessing the test console service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TestConsole } from "effect/testing"
 *
 * const program = TestConsole.testConsoleWith((testConsole) =>
 *   Effect.gen(function*() {
 *     testConsole.log("Test message")
 *     testConsole.error("Test error")
 *
 *     const logs = yield* testConsole.logLines
 *     const errors = yield* testConsole.errorLines
 *
 *     console.log("Logs:", logs) // [["Test message"]]
 *     console.log("Errors:", errors) // [["Test error"]]
 *   })
 * ).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @see {@link layer} for providing the test console service
 * @see {@link logLines} for reading captured `Console.log` calls directly
 * @see {@link errorLines} for reading captured `Console.error` calls directly
 *
 * @category testing
 * @since 4.0.0
 */
export const testConsoleWith = f => Console.consoleWith(console => f(console));
/**
 * Creates a `Layer` which constructs a `TestConsole`.
 * This layer can be used to provide a TestConsole implementation
 * for testing purposes.
 *
 * **When to use**
 *
 * Use to run an effect with console calls captured by `TestConsole`.
 *
 * **Example** (Providing a test console layer)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { TestConsole } from "effect/testing"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("This will be captured")
 *   yield* Console.error("This error will be captured")
 *
 *   const logs = yield* TestConsole.logLines
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log("Captured logs:", logs)
 *   console.log("Captured errors:", errors)
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @see {@link make} for constructing the service value directly
 * @see {@link testConsoleWith} for accessing the provided test console service
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = /*#__PURE__*/Layer.effect(Console.Console)(make);
/**
 * Returns an array of all items that have been logged by the program using
 * `Console.log` thus far.
 *
 * **When to use**
 *
 * Use to assert on captured `Console.log` output from a program provided with
 * `TestConsole.layer`.
 *
 * **Example** (Reading captured log lines)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { TestConsole } from "effect/testing"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.log("First message")
 *   yield* Console.log("Second message", { key: "value" })
 *   yield* Console.log("Third message", 42, true)
 *
 *   const logs = yield* TestConsole.logLines
 *
 *   console.log(logs)
 *   // [
 *   //   ["First message"],
 *   //   ["Second message", { key: "value" }],
 *   //   ["Third message", 42, true]
 *   // ]
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @see {@link errorLines} for reading captured `Console.error` output
 * @see {@link layer} for capturing console calls during a test
 *
 * @category testing
 * @since 4.0.0
 */
export const logLines = /*#__PURE__*/testConsoleWith(console => console.logLines);
/**
 * Returns an array of all items that have been logged by the program using
 * `Console.error` thus far.
 *
 * **When to use**
 *
 * Use to assert on captured `Console.error` output from a program provided
 * with `TestConsole.layer`.
 *
 * **Example** (Reading captured error lines)
 *
 * ```ts
 * import { Console, Effect } from "effect"
 * import { TestConsole } from "effect/testing"
 *
 * const program = Effect.gen(function*() {
 *   yield* Console.error("Error message")
 *   yield* Console.error("Another error", new Error("Something went wrong"))
 *
 *   const errors = yield* TestConsole.errorLines
 *
 *   console.log(errors)
 *   // [
 *   //   ["Error message"],
 *   //   ["Another error", Error: Something went wrong]
 *   // ]
 * }).pipe(Effect.provide(TestConsole.layer))
 * ```
 *
 * @see {@link logLines} for reading captured `Console.log` output
 * @see {@link layer} for capturing console calls during a test
 *
 * @category testing
 * @since 4.0.0
 */
export const errorLines = /*#__PURE__*/testConsoleWith(console => console.errorLines);
//# sourceMappingURL=TestConsole.js.map