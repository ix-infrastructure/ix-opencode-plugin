/**
 * Wraps SQL execution callbacks with request encoding and result decoding.
 *
 * `SqlSchema` is a small adapter between Effect Schema and SQL statements. Each
 * helper builds a function that accepts the decoded request type used by
 * application code, encodes it before calling `execute`, and decodes unknown
 * driver rows into the result schema. The helpers cover returning all rows, a
 * non-empty row list, the first row, an optional first row, or discarding the
 * SQL result for side-effect-only statements.
 *
 * @since 4.0.0
 */
import * as Arr from "../../Array.js";
import * as Cause from "../../Cause.js";
import * as Effect from "../../Effect.js";
import * as Schema from "../../Schema.js";
/**
 * Builds a query function that encodes the request and decodes all result rows,
 * allowing an empty result set.
 *
 * **When to use**
 *
 * Use when you need to run a query that may return zero or more rows and
 * represent an empty result as an empty array.
 *
 * @see {@link findNonEmpty} for queries where an empty result is a failure
 *
 * @category constructors
 * @since 4.0.0
 */
export const findAll = options => {
  const encodeRequest = Schema.encodeEffect(options.Request);
  const decode = Schema.decodeUnknownEffect(Schema.mutable(Schema.Array(options.Result)));
  return request => Effect.flatMap(Effect.flatMap(encodeRequest(request), options.execute), decode);
};
/**
 * Builds a query function that encodes the request, decodes all result rows,
 * and fails with `NoSuchElementError` when the result set is empty.
 *
 * **When to use**
 *
 * Use when you need to run a query that must return at least one row and treat
 * an empty result as a failure.
 *
 * @see {@link findAll} for queries where an empty result should return an empty array
 *
 * @category constructors
 * @since 4.0.0
 */
export const findNonEmpty = options => {
  const find = findAll(options);
  return request => Effect.flatMap(find(request), results => Arr.isArrayNonEmpty(results) ? Effect.succeed(results) : Effect.fail(new Cause.NoSuchElementError()));
};
const void_ = options => {
  const encode = Schema.encodeEffect(options.Request);
  return request => Effect.asVoid(Effect.flatMap(encode(request), options.execute));
};
export {
/**
 * Runs a sql query with a request schema and discard the result.
 *
 * @category constructors
 * @since 4.0.0
 */
void_ as void };
/**
 * Builds a query function that encodes the request, decodes the first result
 * row, and fails with `NoSuchElementError` when no rows are returned.
 *
 * @category constructors
 * @since 4.0.0
 */
export const findOne = options => {
  const encodeRequest = Schema.encodeEffect(options.Request);
  const decode = Schema.decodeUnknownEffect(options.Result);
  return request => Effect.flatMap(Effect.flatMap(encodeRequest(request), options.execute), arr => Arr.isReadonlyArrayNonEmpty(arr) ? decode(arr[0]) : Effect.fail(new Cause.NoSuchElementError()));
};
/**
 * Builds a query function that encodes the request, decodes the first result row
 * as `Option.some`, and returns `Option.none` when no rows are returned.
 *
 * @category constructors
 * @since 4.0.0
 */
export const findOneOption = options => {
  const encodeRequest = Schema.encodeEffect(options.Request);
  const decode = Schema.decodeUnknownEffect(options.Result);
  return request => Effect.flatMap(Effect.flatMap(encodeRequest(request), options.execute), arr => Arr.isReadonlyArrayNonEmpty(arr) ? Effect.asSome(decode(arr[0])) : Effect.succeedNone);
};
//# sourceMappingURL=SqlSchema.js.map