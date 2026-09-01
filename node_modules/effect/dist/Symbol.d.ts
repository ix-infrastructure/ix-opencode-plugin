/**
 * The `Symbol` module contains the runtime predicate for JavaScript primitive
 * `symbol` values. It is most useful at boundaries where a value is `unknown`
 * and must be narrowed before it can be used as a symbol key, identifier, or
 * discriminant.
 *
 * @since 2.0.0
 */
/**
 * Checks whether a value is a `symbol`.
 *
 * **When to use**
 *
 * Use to validate unknown input before treating it as a JavaScript `symbol`.
 *
 * **Example** (Checking for symbols)
 *
 * ```ts
 * import { Symbol } from "effect"
 *
 * console.log(Symbol.isSymbol(globalThis.Symbol.for("a"))) // true
 * console.log(Symbol.isSymbol("a")) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export declare const isSymbol: (u: unknown) => u is symbol;
//# sourceMappingURL=Symbol.d.ts.map