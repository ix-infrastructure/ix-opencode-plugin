/**
 * Defines structured failures for SQL clients and driver integrations.
 *
 * `SqlError` wraps the different reasons a SQL operation can fail, such as
 * connection, authentication, authorization, syntax, constraint, or transaction
 * problems. Each reason keeps the original cause, optional message and
 * operation metadata, and whether retrying may succeed. This module also
 * includes schemas, guards, a SQLite error classifier, and the
 * `ResultLengthMismatch` error used by ordered batched SQL resolvers.
 *
 * @since 4.0.0
 */
import * as Predicate from "../../Predicate.js";
import * as Schema from "../../Schema.js";
const TypeId = "~effect/sql/SqlError";
const ReasonTypeId = "~effect/sql/SqlError/Reason";
const ReasonFields = {
  cause: /*#__PURE__*/Schema.Defect(),
  message: /*#__PURE__*/Schema.optional(Schema.String),
  operation: /*#__PURE__*/Schema.optional(Schema.String)
};
/**
 * SQL error reason for connection or open failures; marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class ConnectionError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/ConnectionError")("ConnectionError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return true;
  }
}
/**
 * SQL error reason for authentication failures such as invalid credentials; not
 * marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class AuthenticationError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/AuthenticationError")("AuthenticationError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
/**
 * SQL error reason for authorization or permission failures; not marked
 * retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class AuthorizationError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/AuthorizationError")("AuthorizationError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
/**
 * SQL error reason for invalid SQL syntax; not marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class SqlSyntaxError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/SqlSyntaxError")("SqlSyntaxError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
const UniqueViolationFields = {
  ...ReasonFields,
  constraint: Schema.String
};
/**
 * SQL error reason for a unique constraint violation, including the violated
 * constraint identifier; not marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class UniqueViolation extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/UniqueViolation")("UniqueViolation", UniqueViolationFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
/**
 * SQL error reason for a non-unique constraint violation; not marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class ConstraintError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/ConstraintError")("ConstraintError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
/**
 * SQL error reason for a database deadlock; marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class DeadlockError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/DeadlockError")("DeadlockError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return true;
  }
}
/**
 * SQL error reason for a transaction serialization or isolation conflict;
 * marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class SerializationError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/SerializationError")("SerializationError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return true;
  }
}
/**
 * SQL error reason for timing out while waiting on a database lock; marked
 * retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class LockTimeoutError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/LockTimeoutError")("LockTimeoutError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return true;
  }
}
/**
 * SQL error reason for a statement or query timeout; marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class StatementTimeoutError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/StatementTimeoutError")("StatementTimeoutError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return true;
  }
}
/**
 * SQL error reason for an unclassified database failure; not marked retryable.
 *
 * @category errors
 * @since 4.0.0
 */
export class UnknownError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError/UnknownError")("UnknownError", ReasonFields) {
  /**
   * Marks this value as a structured SQL error reason for runtime guards.
   *
   * @since 4.0.0
   */
  [ReasonTypeId] = ReasonTypeId;
  /**
   * Indicates whether retrying the failed SQL operation may succeed.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return false;
  }
}
/**
 * Schema for encoding and decoding SQL error reasons.
 *
 * @category schemas
 * @since 4.0.0
 */
export const SqlErrorReason = /*#__PURE__*/Schema.Union([ConnectionError, AuthenticationError, AuthorizationError, SqlSyntaxError, UniqueViolation, ConstraintError, DeadlockError, SerializationError, LockTimeoutError, StatementTimeoutError, UnknownError]);
/**
 * Error wrapper for SQL failures whose `message`, `cause`, and `isRetryable`
 * values are derived from its `SqlErrorReason`.
 *
 * @category errors
 * @since 4.0.0
 */
export class SqlError extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/SqlError")("SqlError", {
  reason: SqlErrorReason
}) {
  /**
   * Marks this value as the top-level SQL error wrapper for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Exposes the structured SQL reason as the JavaScript error cause.
   *
   * @since 4.0.0
   */
  cause = this.reason;
  /**
   * Uses the reason message when present, otherwise falls back to the reason tag.
   *
   * @since 4.0.0
   */
  get message() {
    return this.reason.message || this.reason._tag;
  }
  /**
   * Delegates retryability to the underlying SQL error reason.
   *
   * @since 4.0.0
   */
  get isRetryable() {
    return this.reason.isRetryable;
  }
}
/**
 * Returns `true` when a value is a `SqlError`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isSqlError = u => Predicate.hasProperty(u, TypeId);
/**
 * Returns `true` when a value is a `SqlErrorReason`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isSqlErrorReason = u => Predicate.hasProperty(u, ReasonTypeId);
const sqliteCodeFromCause = cause => {
  if (!Predicate.hasProperty(cause, "code")) {
    return undefined;
  }
  const code = cause.code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
};
const sqliteNumericCodeFromCause = cause => {
  const code = sqliteCodeFromCause(cause);
  if (typeof code === "number") {
    return code;
  }
  if (!Predicate.hasProperty(cause, "errno")) {
    return undefined;
  }
  const errno = cause.errno;
  return typeof errno === "number" ? errno : undefined;
};
const matchesSqliteNumericCode = (cause, expected) => {
  const code = sqliteCodeFromCause(cause);
  if (code === expected) {
    return true;
  }
  if (!Predicate.hasProperty(cause, "errno")) {
    return false;
  }
  return cause.errno === expected;
};
const matchesSqliteCode = (code, expected) => code === expected || code.startsWith(expected + "_");
const UNKNOWN_CONSTRAINT = "unknown";
const SQLITE_CONSTRAINT_UNIQUE = "SQLITE_CONSTRAINT_UNIQUE";
const SQLITE_CONSTRAINT_UNIQUE_CODE = 2067;
const normalizeConstraintIdentifier = identifier => {
  if (typeof identifier !== "string") {
    return UNKNOWN_CONSTRAINT;
  }
  const trimmed = identifier.trim();
  return trimmed.length === 0 ? UNKNOWN_CONSTRAINT : trimmed;
};
const sqliteUniqueConstraintFromCause = cause => {
  if (Predicate.hasProperty(cause, "constraint")) {
    return normalizeConstraintIdentifier(cause.constraint);
  }
  if (!Predicate.hasProperty(cause, "message")) {
    return UNKNOWN_CONSTRAINT;
  }
  const message = cause.message;
  if (typeof message !== "string") {
    return UNKNOWN_CONSTRAINT;
  }
  const prefix = "UNIQUE constraint failed:";
  const index = message.indexOf(prefix);
  return index === -1 ? UNKNOWN_CONSTRAINT : normalizeConstraintIdentifier(message.slice(index + prefix.length));
};
/**
 * Classifies a native SQLite error cause into a `SqlErrorReason` using its
 * `code` or `errno`, with optional message and operation metadata.
 *
 * @category converting
 * @since 4.0.0
 */
export const classifySqliteError = (cause, {
  message,
  operation
} = {}) => {
  const props = {
    cause,
    message,
    operation
  };
  const code = sqliteCodeFromCause(cause);
  const numericCode = sqliteNumericCodeFromCause(cause);
  if (code === SQLITE_CONSTRAINT_UNIQUE || matchesSqliteNumericCode(cause, SQLITE_CONSTRAINT_UNIQUE_CODE)) {
    return new UniqueViolation({
      ...props,
      constraint: sqliteUniqueConstraintFromCause(cause)
    });
  }
  if (typeof code === "string") {
    if (matchesSqliteCode(code, "SQLITE_AUTH")) {
      return new AuthenticationError(props);
    }
    if (matchesSqliteCode(code, "SQLITE_PERM")) {
      return new AuthorizationError(props);
    }
    if (matchesSqliteCode(code, "SQLITE_CONSTRAINT")) {
      return new ConstraintError(props);
    }
    if (matchesSqliteCode(code, "SQLITE_BUSY") || matchesSqliteCode(code, "SQLITE_LOCKED")) {
      return new LockTimeoutError(props);
    }
    if (matchesSqliteCode(code, "SQLITE_CANTOPEN")) {
      return new ConnectionError(props);
    }
  }
  if (typeof numericCode === "number") {
    const code = numericCode & 0xff;
    switch (code) {
      case 23:
        return new AuthenticationError(props);
      case 3:
        return new AuthorizationError(props);
      case 19:
        return new ConstraintError(props);
      case 5:
      case 6:
        return new LockTimeoutError(props);
      case 14:
        return new ConnectionError(props);
      default:
        return new UnknownError(props);
    }
  }
  return new UnknownError(props);
};
/**
 * Error raised when an ordered batched SQL resolver receives a different number
 * of result rows than requests.
 *
 * @category errors
 * @since 4.0.0
 */
export class ResultLengthMismatch extends /*#__PURE__*/Schema.TaggedErrorClass("effect/sql/ResultLengthMismatch")("ResultLengthMismatch", {
  expected: Schema.Number,
  actual: Schema.Number
}) {
  /**
   * Explains the mismatch between expected and actual batched SQL result counts.
   *
   * @since 4.0.0
   */
  get message() {
    return `Expected ${this.expected} results but got ${this.actual}`;
  }
}
//# sourceMappingURL=SqlError.js.map