/**
 * Defines Effect's type-level unification protocol.
 *
 * Unification collapses unions of protocol-enabled values into their public data
 * types. It is mostly for maintainers of Effect data types and advanced library
 * authors; application code usually benefits from it through APIs such as
 * `Effect`, `Option`, `Result`, `Stream`, `Layer`, and `Match`. This module
 * exports the protocol symbols, the `Unify` type that performs normalization,
 * and `unify`, an identity function that changes only the inferred type.
 *
 * @since 2.0.0
 */
import { identity } from "./Function.js";
/**
 * Applies `Unify` to a value or function return type at compile time.
 *
 * **When to use**
 *
 * Use to keep a value or function unchanged at runtime while normalizing its
 * inferred type with Effect's unification protocol.
 *
 * **Details**
 *
 * This is an identity function at runtime. For functions, the returned function
 * has the same runtime behavior while its return type is normalized with the
 * Effect unification protocol.
 *
 * **Example** (Unifying values and function results)
 *
 * ```ts
 * import { Unify } from "effect"
 *
 * // Unify a simple value
 * const unifiedValue = Unify.unify("hello")
 * // Type: string
 *
 * // Unify a function result
 * const createUnifiableValue = () => ({
 *   value: "test",
 *   [Unify.typeSymbol]: "string" as const,
 *   [Unify.unifySymbol]: { String: () => "test" as const }
 * })
 *
 * const unifiedFunction = Unify.unify(createUnifiableValue)
 * // The result will be properly unified
 *
 * // Unify with curried functions
 * const curriedFunction = (a: string) => (b: number) => ({ result: a + b })
 * const unifiedCurried = Unify.unify(curriedFunction)
 * // Type: (a: string) => (b: number) => Unify<{ result: string }>
 * ```
 *
 * @see {@link Unify} for the type-level normalization applied by this helper
 *
 * @category utility types
 * @since 2.0.0
 */
export const unify = identity;
//# sourceMappingURL=Unify.js.map