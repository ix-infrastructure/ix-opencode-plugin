/**
 * Models HTTP headers for the unstable HTTP client and server modules.
 *
 * `Headers` values are immutable maps keyed by lowercase header name. This
 * module converts common header inputs into that shape, provides helpers for
 * reading and updating header values, and redacts configured sensitive headers
 * when values are inspected.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Equ from "../../Equivalence.ts";
import * as Option from "../../Option.ts";
import * as Record from "../../Record.ts";
import * as Redactable from "../../Redactable.ts";
import * as Redacted from "../../Redacted.ts";
import * as Schema from "../../Schema.ts";
/**
 * Runtime type identifier for `Headers` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export declare const TypeId: unique symbol;
/**
 * Type of the unique symbol used to brand `Headers` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = typeof TypeId;
/**
 * Returns `true` if the provided value is a `Headers` value.
 *
 * @category refinements
 * @since 4.0.0
 */
export declare const isHeaders: (u: unknown) => u is Headers;
/**
 * Represents an immutable HTTP header collection keyed by lowercase header name.
 *
 * **Details**
 *
 * `Headers` values also support redaction through the `Redactable` protocol.
 *
 * @category models
 * @since 4.0.0
 */
export interface Headers extends Redactable.Redactable {
    readonly [TypeId]: TypeId;
    readonly [key: string]: string;
}
/**
 * Provides an `Equivalence` instance that compares `Headers` by header names
 * and string values.
 *
 * @category instances
 * @since 4.0.0
 */
export declare const Equivalence: Equ.Equivalence<Headers>;
/**
 * Schema interface for `Headers` values encoded as records of string header values.
 *
 * @category schemas
 * @since 4.0.0
 */
export interface HeadersSchema extends Schema.declare<Headers, {
    readonly [x: string]: string;
}> {
}
/**
 * Schema for `Headers` values encoded as records of string header values.
 *
 * **Details**
 *
 * Decoding normalizes header names through `fromInput`; encoding returns a plain record.
 *
 * @category schemas
 * @since 4.0.0
 */
export declare const HeadersSchema: HeadersSchema;
/**
 * Input accepted when constructing headers.
 *
 * **Details**
 *
 * Records may contain string values, string arrays, or `undefined`; arrays are joined with `", "`, and `undefined` values are omitted.
 *
 * @category models
 * @since 4.0.0
 */
export type Input = Record.ReadonlyRecord<string, string | ReadonlyArray<string> | undefined> | Iterable<readonly [string, string]>;
/**
 * An empty `Headers` collection.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const empty: Headers;
/**
 * Creates `Headers` from a record or iterable of header entries.
 *
 * **Details**
 *
 * Header names are normalized to lowercase. Array values in record input are joined with `", "`, and `undefined` values are omitted.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const fromInput: (input?: Input) => Headers;
/**
 * Treats an existing record as `Headers` unsafely.
 *
 * **Gotchas**
 *
 * This mutates the record's prototype and does not normalize header names; callers must provide the expected lowercase keys.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const fromRecordUnsafe: (input: Record.ReadonlyRecord<string, string>) => Headers;
/**
 * Returns `true` when a header with the given name is present.
 *
 * **Details**
 *
 * The lookup lowercases the provided header name.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const has: {
    /**
     * Returns `true` when a header with the given name is present.
     *
     * **Details**
     *
     * The lookup lowercases the provided header name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (key: string): (self: Headers) => boolean;
    /**
     * Returns `true` when a header with the given name is present.
     *
     * **Details**
     *
     * The lookup lowercases the provided header name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, key: string): boolean;
};
/**
 * Gets a header value by name safely.
 *
 * **Details**
 *
 * The lookup lowercases the provided header name and returns `Option.none()` when absent.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const get: {
    /**
     * Gets a header value by name safely.
     *
     * **Details**
     *
     * The lookup lowercases the provided header name and returns `Option.none()` when absent.
     *
     * @category combinators
     * @since 4.0.0
     */
    (key: string): (self: Headers) => Option.Option<string>;
    /**
     * Gets a header value by name safely.
     *
     * **Details**
     *
     * The lookup lowercases the provided header name and returns `Option.none()` when absent.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, key: string): Option.Option<string>;
};
/**
 * Returns a new `Headers` collection with the given header set.
 *
 * **Details**
 *
 * The header name is normalized to lowercase.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const set: {
    /**
     * Returns a new `Headers` collection with the given header set.
     *
     * **Details**
     *
     * The header name is normalized to lowercase.
     *
     * @category combinators
     * @since 4.0.0
     */
    (key: string, value: string): (self: Headers) => Headers;
    /**
     * Returns a new `Headers` collection with the given header set.
     *
     * **Details**
     *
     * The header name is normalized to lowercase.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, key: string, value: string): Headers;
};
/**
 * Returns a new `Headers` collection with all provided headers set.
 *
 * **Details**
 *
 * Input headers are normalized with `fromInput` and override existing headers with the same lowercase name.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const setAll: {
    /**
     * Returns a new `Headers` collection with all provided headers set.
     *
     * **Details**
     *
     * Input headers are normalized with `fromInput` and override existing headers with the same lowercase name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (headers: Input): (self: Headers) => Headers;
    /**
     * Returns a new `Headers` collection with all provided headers set.
     *
     * **Details**
     *
     * Input headers are normalized with `fromInput` and override existing headers with the same lowercase name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, headers: Input): Headers;
};
/**
 * Returns a new `Headers` collection containing headers from both collections.
 *
 * **Details**
 *
 * Headers from the second collection override headers from the first collection with the same name.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const merge: {
    /**
     * Returns a new `Headers` collection containing headers from both collections.
     *
     * **Details**
     *
     * Headers from the second collection override headers from the first collection with the same name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (headers: Headers): (self: Headers) => Headers;
    /**
     * Returns a new `Headers` collection containing headers from both collections.
     *
     * **Details**
     *
     * Headers from the second collection override headers from the first collection with the same name.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, headers: Headers): Headers;
};
/**
 * Returns a new `Headers` collection with the named header removed.
 *
 * **Details**
 *
 * The provided header name is normalized to lowercase before removal.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const remove: {
    /**
     * Returns a new `Headers` collection with the named header removed.
     *
     * **Details**
     *
     * The provided header name is normalized to lowercase before removal.
     *
     * @category combinators
     * @since 4.0.0
     */
    (key: string): (self: Headers) => Headers;
    /**
     * Returns a new `Headers` collection with the named header removed.
     *
     * **Details**
     *
     * The provided header name is normalized to lowercase before removal.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, key: string): Headers;
};
/**
 * Returns a new `Headers` collection with each named header removed.
 *
 * **Details**
 *
 * Each provided header name is normalized to lowercase before removal.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const removeMany: {
    /**
     * Returns a new `Headers` collection with each named header removed.
     *
     * **Details**
     *
     * Each provided header name is normalized to lowercase before removal.
     *
     * @category combinators
     * @since 4.0.0
     */
    (keys: Iterable<string>): (self: Headers) => Headers;
    /**
     * Returns a new `Headers` collection with each named header removed.
     *
     * **Details**
     *
     * Each provided header name is normalized to lowercase before removal.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, keys: Iterable<string>): Headers;
};
/**
 * Returns a plain record with selected header values wrapped in `Redacted`.
 *
 * **Details**
 *
 * String keys are normalized to lowercase before matching; regular expressions are tested against the stored header names.
 *
 * @category combinators
 * @since 4.0.0
 */
export declare const redact: {
    /**
     * Returns a plain record with selected header values wrapped in `Redacted`.
     *
     * **Details**
     *
     * String keys are normalized to lowercase before matching; regular expressions are tested against the stored header names.
     *
     * @category combinators
     * @since 4.0.0
     */
    (key: string | RegExp | ReadonlyArray<string | RegExp>): (self: Headers) => Record<string, string | Redacted.Redacted>;
    /**
     * Returns a plain record with selected header values wrapped in `Redacted`.
     *
     * **Details**
     *
     * String keys are normalized to lowercase before matching; regular expressions are tested against the stored header names.
     *
     * @category combinators
     * @since 4.0.0
     */
    (self: Headers, key: string | RegExp | ReadonlyArray<string | RegExp>): Record<string, string | Redacted.Redacted>;
};
/**
 * Context reference listing header names or patterns that should be redacted when `Headers` are inspected or rendered.
 *
 * **Details**
 *
 * Defaults include `authorization`, `cookie`, `set-cookie`, and `x-api-key`.
 *
 * @category fiber refs
 * @since 4.0.0
 */
export declare const CurrentRedactedNames: Context.Reference<readonly (string | RegExp)[]>;
//# sourceMappingURL=Headers.d.ts.map