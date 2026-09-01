/**
 * Defines supported HTTP method names for the unstable HTTP modules.
 *
 * Values are uppercase string literals such as `"GET"` and `"POST"`, matching
 * the method tokens used by HTTP requests and routes. This module also includes
 * helpers for checking whether a method can carry a request body and whether an
 * unknown value is one of the supported methods.
 *
 * @since 4.0.0
 */
/**
 * Union of supported uppercase HTTP method literals.
 *
 * @category models
 * @since 4.0.0
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "TRACE";
/**
 * Namespace containing subtype helpers associated with `HttpMethod`.
 *
 * @since 4.0.0
 */
export declare namespace HttpMethod {
    /**
     * HTTP methods that this module treats as not carrying a request body.
     *
     * @category models
     * @since 4.0.0
     */
    type NoBody = "GET" | "HEAD" | "OPTIONS" | "TRACE";
    /**
     * HTTP methods that this module treats as capable of carrying a request body.
     *
     * @category models
     * @since 4.0.0
     */
    type WithBody = Exclude<HttpMethod, NoBody>;
}
/**
 * Returns `true` when a method can carry a request body and narrows it to `HttpMethod.WithBody`.
 *
 * @category predicates
 * @since 4.0.0
 */
export declare const hasBody: (method: HttpMethod) => method is HttpMethod.WithBody;
/**
 * Provides a readonly set containing every supported `HttpMethod` literal.
 *
 * **When to use**
 *
 * Use when you need to iterate over or test membership against every supported
 * HTTP method literal.
 *
 * @category constants
 * @since 4.0.0
 */
export declare const all: ReadonlySet<HttpMethod>;
/**
 * Provides tuples mapping each supported HTTP method to its short
 * request-constructor name.
 *
 * **When to use**
 *
 * Use when you need the mapping from supported HTTP method literals to their
 * short request-constructor names.
 *
 * @category constants
 * @since 4.0.0
 */
export declare const allShort: readonly [readonly ["GET", "get"], readonly ["POST", "post"], readonly ["PUT", "put"], readonly ["DELETE", "del"], readonly ["PATCH", "patch"], readonly ["HEAD", "head"], readonly ["OPTIONS", "options"], readonly ["TRACE", "trace"]];
/**
 * Checks whether a value is a `HttpMethod`.
 *
 * **Example** (Checking HTTP method values)
 *
 * ```ts
 * import { HttpMethod } from "effect/unstable/http"
 *
 * console.log(HttpMethod.isHttpMethod("GET"))
 * // true
 * console.log(HttpMethod.isHttpMethod("get"))
 * // false
 * console.log(HttpMethod.isHttpMethod(1))
 * // false
 * ```
 *
 * @category refinements
 * @since 4.0.0
 */
export declare const isHttpMethod: (u: unknown) => u is HttpMethod;
//# sourceMappingURL=HttpMethod.d.ts.map