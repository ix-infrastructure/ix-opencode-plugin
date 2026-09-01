/**
 * Transactional references for coordinating mutable state with Effect
 * transactions. A `TxRef` stores a current value, but reads and writes inside
 * `Effect.tx` are recorded in a transaction journal and committed together only
 * when the outermost transaction succeeds.
 *
 * This is the basic building block behind the other transactional collections
 * in Effect. The module provides effectful and unsafe constructors plus the
 * core operations for reading, setting, updating, and modifying a transactional
 * value while returning a separate result.
 *
 * @since 4.0.0
 */
import * as Effect from "./Effect.js";
import { dual } from "./Function.js";
import { pipeArguments } from "./Pipeable.js";
const TypeId = "~effect/transactions/TxRef";
/**
 * Creates a new `TxRef` with the specified initial value.
 *
 * **When to use**
 *
 * Use to create a `TxRef` inside an `Effect` workflow.
 *
 * **Example** (Creating transactional references)
 *
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a transactional reference with initial value
 *   const counter = yield* TxRef.make(0)
 *   const name = yield* TxRef.make("Alice")
 *
 *   // Use in transactions
 *   yield* Effect.tx(Effect.gen(function*() {
 *     yield* TxRef.set(counter, 42)
 *     yield* TxRef.set(name, "Bob")
 *   }))
 *
 *   console.log(yield* TxRef.get(counter)) // 42
 *   console.log(yield* TxRef.get(name)) // "Bob"
 * })
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const make = initial => Effect.sync(() => makeUnsafe(initial));
/**
 * Creates a new `TxRef` synchronously with the specified initial value.
 *
 * **When to use**
 *
 * Use to construct a `TxRef` synchronously when it must be created outside an
 * `Effect` workflow.
 *
 * **Example** (Creating transactional references unsafely)
 *
 * ```ts
 * import { TxRef } from "effect"
 *
 * // Create a TxRef synchronously (unsafe - use make instead in Effect contexts)
 * const counter = TxRef.makeUnsafe(0)
 * const config = TxRef.makeUnsafe({ timeout: 5000, retries: 3 })
 *
 * // These are now ready to use in transactions
 * console.log(counter.value) // 0
 * console.log(config.value) // { timeout: 5000, retries: 3 }
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeUnsafe = initial => ({
  [TypeId]: TypeId,
  pending: new Map(),
  pipe() {
    return pipeArguments(this, arguments);
  },
  version: 0,
  value: initial
});
/**
 * Modifies the value of the `TxRef` using the provided function.
 *
 * **When to use**
 *
 * Use to update a `TxRef` and return a computed result from the same
 * transaction step.
 *
 * **Example** (Modifying transactional references)
 *
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const counter = yield* TxRef.make(0)
 *
 *   // Modify and return both old and new value
 *   const result = yield* TxRef.modify(counter, (current) => [current * 2, current + 1])
 *
 *   console.log(result) // 0 (the return value: current * 2)
 *   console.log(yield* TxRef.get(counter)) // 1 (the new value: current + 1)
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const modify = /*#__PURE__*/dual(2, (self, f) => Effect.Transaction.pipe(Effect.flatMap(state => Effect.sync(() => {
  if (!state.journal.has(self)) {
    state.journal.set(self, {
      version: self.version,
      value: self.value
    });
  }
  const current = state.journal.get(self);
  const [returnValue, next] = f(current.value);
  current.value = next;
  return returnValue;
})), Effect.tx));
/**
 * Updates the value of the `TxRef` using the provided function.
 *
 * **When to use**
 *
 * Use to transform a `TxRef` when no result value is needed.
 *
 * **Example** (Updating transactional references)
 *
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const counter = yield* TxRef.make(10)
 *
 *   // Update the value using a function
 *   yield* Effect.tx(
 *     TxRef.update(counter, (current) => current * 2)
 *   )
 *
 *   console.log(yield* TxRef.get(counter)) // 20
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const update = /*#__PURE__*/dual(2, (self, f) => modify(self, current => [void 0, f(current)]));
/**
 * Reads the current value of the `TxRef`.
 *
 * **When to use**
 *
 * Use to read the current value of a `TxRef`.
 *
 * **Example** (Reading transactional references)
 *
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const counter = yield* TxRef.make(42)
 *
 *   // Read the value within a transaction
 *   const value = yield* Effect.tx(
 *     TxRef.get(counter)
 *   )
 *
 *   console.log(value) // 42
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const get = self => modify(self, current => [current, current]);
/**
 * Sets the value of the `TxRef`.
 *
 * **When to use**
 *
 * Use to replace the value of a `TxRef`.
 *
 * **Example** (Setting transactional references)
 *
 * ```ts
 * import { Effect, TxRef } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const counter = yield* TxRef.make(0)
 *
 *   // Set a new value within a transaction
 *   yield* Effect.tx(
 *     TxRef.set(counter, 100)
 *   )
 *
 *   console.log(yield* TxRef.get(counter)) // 100
 * })
 * ```
 *
 * @category combinators
 * @since 2.0.0
 */
export const set = /*#__PURE__*/dual(2, (self, value) => update(self, () => value));
//# sourceMappingURL=TxRef.js.map