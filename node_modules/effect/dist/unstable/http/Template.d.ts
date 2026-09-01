/**
 * Builds HTTP response text from template literals.
 *
 * Template interpolations can be plain values, optional values, effects, or
 * streams. The resulting effect or stream keeps the errors and service
 * requirements from any effectful interpolations, which lets response helpers
 * assemble dynamic text without losing type information.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts";
import * as Option from "../../Option.ts";
import * as Stream from "../../Stream.ts";
/**
 * Primitive value that can be interpolated into an HTTP template.
 *
 * @category models
 * @since 4.0.0
 */
export type PrimitiveValue = string | number | bigint | boolean | null | undefined;
/**
 * Primitive template interpolation value.
 *
 * **Details**
 *
 * Arrays are rendered by converting each element to a string and concatenating the
 * results.
 *
 * @category models
 * @since 4.0.0
 */
export type Primitive = PrimitiveValue | ReadonlyArray<PrimitiveValue>;
/**
 * Value accepted by the string template constructor.
 *
 * **Details**
 *
 * Interpolations can be primitive values, optional primitive values, or effects
 * that produce primitive values.
 *
 * @category models
 * @since 4.0.0
 */
export type Interpolated = Primitive | Option.Option<Primitive> | Effect.Effect<Primitive, any, any>;
/**
 * Value accepted by the streaming template constructor.
 *
 * **Details**
 *
 * In addition to normal interpolations, stream interpolations can emit primitive
 * values over time.
 *
 * @category models
 * @since 4.0.0
 */
export type InterpolatedWithStream = Interpolated | Stream.Stream<Primitive, any, any>;
/**
 * Namespace containing type-level helpers for template interpolations.
 *
 * @since 4.0.0
 */
export declare namespace Interpolated {
    /**
     * Extracts the required context from an effect or stream interpolation.
     *
     * **Details**
     *
     * Plain values and `Option` interpolations contribute no context.
     *
     * @category models
     * @since 4.0.0
     */
    type Context<A> = A extends infer T ? T extends Option.Option<infer _> ? never : T extends Effect.Effect<infer _A, infer _E, infer R> ? R : T extends Stream.Stream<infer _A, infer _E, infer R> ? R : never : never;
    /**
     * Extracts the error type from an effect or stream interpolation.
     *
     * **Details**
     *
     * Plain values and `Option` interpolations contribute no error type.
     *
     * @category models
     * @since 4.0.0
     */
    type Error<A> = A extends infer T ? T extends Option.Option<infer _> ? never : T extends Stream.Stream<infer _A, infer E, infer _R> ? E : T extends Effect.Effect<infer _A, infer E, infer _R> ? E : never : never;
}
/**
 * Creates an effectful string from a template literal.
 *
 * **Details**
 *
 * Primitive and `Option` interpolations are rendered immediately. Effect
 * interpolations are evaluated and rendered before the final string is produced.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare function make<A extends ReadonlyArray<Interpolated>>(strings: TemplateStringsArray, ...args: A): Effect.Effect<string, Interpolated.Error<A[number]>, Interpolated.Context<A[number]>>;
/**
 * Creates a stream of strings from a template literal.
 *
 * **Details**
 *
 * Static text is emitted with interpolated values. Effect interpolations are
 * evaluated as stream chunks, and stream interpolations are flattened into the
 * output.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare function stream<A extends ReadonlyArray<InterpolatedWithStream>>(strings: TemplateStringsArray, ...args: A): Stream.Stream<string, Interpolated.Error<A[number]>, Interpolated.Context<A[number]>>;
//# sourceMappingURL=Template.d.ts.map