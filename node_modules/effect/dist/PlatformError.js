/**
 * Normalized errors for platform APIs.
 *
 * Platform services such as file systems, terminals, and sockets use
 * `PlatformError` to report host-level failures in a consistent shape. The
 * wrapper records whether the problem came from an invalid argument or from the
 * operating system, while preserving useful details such as the module, method,
 * path, descriptor, description, and original cause when available.
 *
 * @since 4.0.0
 */
import * as Data from "./Data.js";
const TypeId = "~effect/platform/PlatformError";
/**
 * Error data for an invalid argument passed to a platform API.
 *
 * **When to use**
 *
 * Use when you need to model caller input rejected before a platform operation
 * runs, including invalid-argument reason data.
 *
 * **Details**
 *
 * The error records the module and method that rejected the argument, with an
 * optional description and cause. It is usually wrapped in `PlatformError`.
 *
 * @see {@link badArgument} for creating a wrapped `PlatformError` whose reason is `BadArgument`
 * @see {@link SystemError} for failures reported by the host platform or operating system
 * @see {@link PlatformError} for the wrapper used by most platform APIs
 *
 * @category models
 * @since 4.0.0
 */
export class BadArgument extends /*#__PURE__*/Data.TaggedError("BadArgument") {
  /**
   * Formats the module, method, and optional description that rejected the argument.
   *
   * **When to use**
   *
   * Use to read the formatted error message for a rejected platform argument.
   *
   * @since 4.0.0
   */
  get message() {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`;
  }
}
/**
 * Error data for a platform or system operation failure.
 *
 * **When to use**
 *
 * Use when you need normalized reason data for a platform or system operation
 * failure, including the operation details.
 *
 * **Details**
 *
 * The error records a normalized `_tag`, the module and method that failed,
 * and optional details such as the syscall, path or descriptor, description,
 * and original cause. It is usually wrapped in `PlatformError`.
 *
 * @see {@link systemError} for creating the usual `PlatformError` wrapper from this reason data
 * @see {@link BadArgument} for platform API failures caused by rejected caller input before an operation runs
 * @see {@link SystemErrorTag} for the normalized tag values stored in `_tag`
 *
 * @category models
 * @since 4.0.0
 */
export class SystemError extends Data.Error {
  /**
   * Formats the normalized system error tag with operation and path details.
   *
   * **When to use**
   *
   * Use to read the formatted error message for a normalized system failure.
   *
   * @since 4.0.0
   */
  get message() {
    return `${this._tag}: ${this.module}.${this.method}${this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""}${this.description ? `: ${this.description}` : ""}`;
  }
}
/**
 * Tagged error used by platform APIs to report either invalid arguments or
 * system-level failures.
 *
 * **When to use**
 *
 * Use as the shared error type for platform APIs that expose invalid arguments
 * and host or operating-system failures through a single `Effect` error
 * channel.
 *
 * **Details**
 *
 * The `reason` field contains the underlying `BadArgument` or `SystemError`.
 * When that reason has a cause, the cause is preserved on the wrapper.
 *
 * @see {@link BadArgument} for invalid inputs rejected before an operation runs
 * @see {@link SystemError} for failures reported by the host platform or operating system
 * @see {@link badArgument} for creating this wrapper from rejected caller input
 * @see {@link systemError} for creating this wrapper from a host or operating-system failure
 *
 * @category models
 * @since 4.0.0
 */
export class PlatformError extends /*#__PURE__*/Data.TaggedError("PlatformError") {
  constructor(reason) {
    if ("cause" in reason) {
      super({
        reason,
        cause: reason.cause
      });
    } else {
      super({
        reason
      });
    }
  }
  /**
   * Marks this value as a platform error wrapper for runtime guards.
   *
   * **When to use**
   *
   * Use to identify `PlatformError` values through their runtime type marker.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  get message() {
    return this.reason.message;
  }
}
/**
 * Creates a `PlatformError` whose reason is a `SystemError`.
 *
 * **When to use**
 *
 * Use to adapt an operating-system or platform failure into the normalized
 * platform error model.
 *
 * @category constructors
 * @since 4.0.0
 */
export const systemError = options => new PlatformError(new SystemError(options));
/**
 * Creates a `PlatformError` whose reason is a `BadArgument`.
 *
 * **When to use**
 *
 * Use to report a platform API rejecting caller input before performing the
 * underlying operation.
 *
 * @category constructors
 * @since 4.0.0
 */
export const badArgument = options => new PlatformError(new BadArgument(options));
//# sourceMappingURL=PlatformError.js.map