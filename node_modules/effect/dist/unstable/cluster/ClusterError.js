/**
 * Defines the structured errors used by the unstable cluster runtime.
 *
 * These tagged, schema-backed errors describe failures at routing, runner
 * membership, serialization, persistence, mailbox capacity, and duplicate
 * envelope boundaries. Cluster clients, runners, and storage adapters use these
 * shared error values to report failures through typed Effect errors.
 *
 * @since 4.0.0
 */
import * as Cause from "../../Cause.js";
import * as Effect from "../../Effect.js";
import { hasProperty, isTagged } from "../../Predicate.js";
import * as Schema from "../../Schema.js";
import { EntityAddress } from "./EntityAddress.js";
import { RunnerAddress } from "./RunnerAddress.js";
import { SnowflakeFromString } from "./Snowflake.js";
const TypeId = "~effect/cluster/ClusterError";
/**
 * Represents an error that occurs when a Runner receives a message for an entity
 * that is not assigned to the receiving runner.
 *
 * @category errors
 * @since 4.0.0
 */
export class EntityNotAssignedToRunner extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/EntityNotAssignedToRunner`)({
  _tag: /*#__PURE__*/Schema.tag("EntityNotAssignedToRunner"),
  address: EntityAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Returns `true` when the value is an `EntityNotAssignedToRunner` error.
   *
   * @since 4.0.0
   */
  static is(u) {
    return hasProperty(u, TypeId) && isTagged(u, "EntityNotAssignedToRunner");
  }
}
/**
 * Represents an error that occurs when a message fails at a schema
 * serialization or deserialization boundary.
 *
 * **Details**
 *
 * `cause` carries the underlying failure. `refail` maps encode and decode
 * failures into `MalformedMessage` values.
 *
 * @category errors
 * @since 4.0.0
 */
export class MalformedMessage extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/MalformedMessage`)({
  _tag: /*#__PURE__*/Schema.tag("MalformedMessage"),
  cause: /*#__PURE__*/Schema.Defect()
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Returns `true` when the value is a `MalformedMessage` error.
   *
   * @since 4.0.0
   */
  static is(u) {
    return hasProperty(u, TypeId) && isTagged(u, "MalformedMessage");
  }
  /**
   * Maps failures from the supplied effect into `MalformedMessage` errors.
   *
   * @since 4.0.0
   */
  static refail = /*#__PURE__*/Effect.mapError(cause => new MalformedMessage({
    cause
  }));
}
/**
 * Represents an error that occurs when a message fails to be persisted into
 * cluster's mailbox storage.
 *
 * @category errors
 * @since 4.0.0
 */
export class PersistenceError extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/PersistenceError`)({
  _tag: /*#__PURE__*/Schema.tag("PersistenceError"),
  cause: /*#__PURE__*/Schema.Defect()
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Maps failures from the supplied effect into `PersistenceError` values.
   *
   * @since 4.0.0
   */
  static refail(effect) {
    return Effect.catchCause(effect, cause => Effect.fail(new PersistenceError({
      cause: Cause.squash(cause)
    })));
  }
}
/**
 * Represents an error that occurs when a Runner is not registered with the shard
 * manager.
 *
 * @category errors
 * @since 4.0.0
 */
export class RunnerNotRegistered extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/RunnerNotRegistered`)({
  _tag: /*#__PURE__*/Schema.tag("RunnerNotRegistered"),
  address: RunnerAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
}
/**
 * Represents an error that occurs when a Runner is unresponsive.
 *
 * @category errors
 * @since 4.0.0
 */
export class RunnerUnavailable extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/RunnerUnavailable`)({
  _tag: /*#__PURE__*/Schema.tag("RunnerUnavailable"),
  address: RunnerAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Returns `true` when the value is a `RunnerUnavailable` error.
   *
   * @since 4.0.0
   */
  static is(u) {
    return hasProperty(u, TypeId) && isTagged(u, "RunnerUnavailable");
  }
}
/**
 * Represents an error that occurs when the entity mailbox is full.
 *
 * **Details**
 *
 * Carries the `address` whose bounded mailbox is at capacity.
 *
 * **Gotchas**
 *
 * Volatile requests fail immediately. Persisted or durable messages are retried
 * or resumed from storage when the mailbox is full.
 *
 * @category errors
 * @since 4.0.0
 */
export class MailboxFull extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/MailboxFull`)({
  _tag: /*#__PURE__*/Schema.tag("MailboxFull"),
  address: EntityAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Returns `true` when the value is a `MailboxFull` error.
   *
   * @since 4.0.0
   */
  static is(u) {
    return hasProperty(u, TypeId) && isTagged(u, "MailboxFull");
  }
}
/**
 * Represents an error that occurs when the same request envelope is already
 * being processed.
 *
 * **Details**
 *
 * Carries the `address` and `envelopeId` for the affected request envelope.
 *
 * @category errors
 * @since 4.0.0
 */
export class AlreadyProcessingMessage extends /*#__PURE__*/Schema.ErrorClass(`${TypeId}/AlreadyProcessingMessage`)({
  _tag: /*#__PURE__*/Schema.tag("AlreadyProcessingMessage"),
  envelopeId: SnowflakeFromString,
  address: EntityAddress
}) {
  /**
   * Marks this value as a cluster error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Returns `true` when the value is an `AlreadyProcessingMessage` error.
   *
   * @since 4.0.0
   */
  static is(u) {
    return hasProperty(u, TypeId) && isTagged(u, "AlreadyProcessingMessage");
  }
}
//# sourceMappingURL=ClusterError.js.map