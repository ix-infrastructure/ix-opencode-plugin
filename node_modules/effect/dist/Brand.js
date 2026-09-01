/**
 * The `Brand` module adds compile-time names to ordinary TypeScript values so
 * structurally identical values cannot be mixed accidentally. A branded value
 * has the same runtime representation as its unbranded value; the extra
 * information lives in the type system unless you choose a validating
 * constructor.
 *
 * @since 2.0.0
 */
import * as Arr from "./Array.js";
import * as Option from "./Option.js";
import * as Result from "./Result.js";
import * as SchemaAST from "./SchemaAST.js";
const TypeId = "~effect/Brand";
/**
 * Error returned when a branded type is constructed from an invalid value.
 *
 * **Details**
 *
 * The error wraps a `SchemaIssue.Issue`, exposes `message` through
 * `issue.toString()`, and formats as `BrandError(<message>)`.
 *
 * **Gotchas**
 *
 * `BrandError` is an error-like model with `_tag`, `name`, `message`, and
 * `toString`; it does not extend JavaScript `Error`.
 *
 * @category errors
 * @since 4.0.0
 */
export class BrandError {
  constructor(issue) {
    this.issue = issue;
  }
  /**
   * Discriminant used to identify brand construction failures.
   *
   * @since 4.0.0
   */
  _tag = "BrandError";
  /**
   * Error name used by tools that inspect JavaScript error-like objects.
   *
   * @since 4.0.0
   */
  name = "BrandError";
  /**
   * Schema issue describing why brand validation failed.
   *
   * @since 4.0.0
   */
  issue;
  /**
   * Human-readable rendering of the validation issue.
   *
   * @since 4.0.0
   */
  get message() {
    return this.issue.toString();
  }
  /**
   * Formats the brand error together with its validation message.
   *
   * @since 4.0.0
   */
  toString() {
    return `BrandError(${this.message})`;
  }
}
/**
 * Returns a `Constructor` that **does not apply any runtime checks** and just
 * returns the provided value.
 *
 * **When to use**
 *
 * Use to create nominal types that allow distinguishing between two values
 * of the same type but with different meanings.
 *
 * @see {@link make} for constructing branded values with validation.
 * @see {@link check} for constructing branded values from schema checks.
 *
 * @category constructors
 * @since 2.0.0
 */
export function nominal() {
  return Object.assign(input => input, {
    option: input => Option.some(input),
    result: input => Result.succeed(input),
    is: _ => true
  });
}
/**
 * Returns a `Constructor` that can construct a branded type from an unbranded
 * value using the provided `filter` predicate as validation of the input data.
 *
 * **When to use**
 *
 * Use when you want validation while constructing the branded type.
 *
 * @see {@link nominal} for a brand constructor that performs no validation.
 *
 * @category constructors
 * @since 4.0.0
 */
export function make(filter) {
  return check(SchemaAST.makeFilter(filter));
}
/**
 * Creates a branded type `Constructor` from one or more schema checks.
 *
 * **When to use**
 *
 * Use when you need a branded type constructor that performs runtime validation
 * via schema checks.
 *
 * **Details**
 *
 * Calling the returned constructor validates the unbranded value and throws on
 * failure. Use the returned `option`, `result`, or `is` methods for
 * non-throwing validation.
 *
 * @see {@link nominal} for a brand constructor without runtime validation
 * @see {@link all} for combining multiple brand constructors
 * @category constructors
 * @since 4.0.0
 */
export function check(...checks) {
  const result = input => {
    return Result.mapError(SchemaAST.runChecks(checks, input), issue => new BrandError(issue));
  };
  return Object.assign(input => Result.getOrThrow(result(input)), {
    option: input => Option.getSuccess(result(input)),
    result,
    is: input => Result.isSuccess(result(input)),
    checks
  });
}
/**
 * Combines one or more brand constructors to form a single branded type.
 *
 * **When to use**
 *
 * Use to require an input to satisfy every runtime check collected by the
 * provided brand constructors.
 *
 * **Details**
 *
 * If the provided constructors contain runtime checks, the combined
 * constructor succeeds only when all checks pass. If no runtime checks are
 * present, it behaves as a nominal constructor.
 *
 * @category combining
 * @since 2.0.0
 */
export function all(...brands) {
  const checks = brands.flatMap(brand => brand.checks ?? []);
  return Arr.isArrayNonEmpty(checks) ? check(...checks) : nominal();
}
//# sourceMappingURL=Brand.js.map