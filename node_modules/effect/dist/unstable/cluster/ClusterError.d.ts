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
import * as Cause from "../../Cause.ts";
import * as Effect from "../../Effect.ts";
import * as Schema from "../../Schema.ts";
import { EntityAddress } from "./EntityAddress.ts";
import { RunnerAddress } from "./RunnerAddress.ts";
import { SnowflakeFromString } from "./Snowflake.ts";
declare const TypeId = "~effect/cluster/ClusterError";
declare const EntityNotAssignedToRunner_base: Schema.Class<EntityNotAssignedToRunner, Schema.Struct<{
    readonly _tag: Schema.tag<"EntityNotAssignedToRunner">;
    readonly address: typeof EntityAddress;
}>, Cause.YieldableError>;
/**
 * Represents an error that occurs when a Runner receives a message for an entity
 * that is not assigned to the receiving runner.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class EntityNotAssignedToRunner extends EntityNotAssignedToRunner_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Returns `true` when the value is an `EntityNotAssignedToRunner` error.
     *
     * @since 4.0.0
     */
    static is(u: unknown): u is EntityNotAssignedToRunner;
}
declare const MalformedMessage_base: Schema.Class<MalformedMessage, Schema.Struct<{
    readonly _tag: Schema.tag<"MalformedMessage">;
    readonly cause: Schema.Defect;
}>, Cause.YieldableError>;
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
export declare class MalformedMessage extends MalformedMessage_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Returns `true` when the value is a `MalformedMessage` error.
     *
     * @since 4.0.0
     */
    static is(u: unknown): u is MalformedMessage;
    /**
     * Maps failures from the supplied effect into `MalformedMessage` errors.
     *
     * @since 4.0.0
     */
    static refail: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, MalformedMessage, R>;
}
declare const PersistenceError_base: Schema.Class<PersistenceError, Schema.Struct<{
    readonly _tag: Schema.tag<"PersistenceError">;
    readonly cause: Schema.Defect;
}>, Cause.YieldableError>;
/**
 * Represents an error that occurs when a message fails to be persisted into
 * cluster's mailbox storage.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class PersistenceError extends PersistenceError_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Maps failures from the supplied effect into `PersistenceError` values.
     *
     * @since 4.0.0
     */
    static refail<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R>;
}
declare const RunnerNotRegistered_base: Schema.Class<RunnerNotRegistered, Schema.Struct<{
    readonly _tag: Schema.tag<"RunnerNotRegistered">;
    readonly address: typeof RunnerAddress;
}>, Cause.YieldableError>;
/**
 * Represents an error that occurs when a Runner is not registered with the shard
 * manager.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class RunnerNotRegistered extends RunnerNotRegistered_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
}
declare const RunnerUnavailable_base: Schema.Class<RunnerUnavailable, Schema.Struct<{
    readonly _tag: Schema.tag<"RunnerUnavailable">;
    readonly address: typeof RunnerAddress;
}>, Cause.YieldableError>;
/**
 * Represents an error that occurs when a Runner is unresponsive.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class RunnerUnavailable extends RunnerUnavailable_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Returns `true` when the value is a `RunnerUnavailable` error.
     *
     * @since 4.0.0
     */
    static is(u: unknown): u is RunnerUnavailable;
}
declare const MailboxFull_base: Schema.Class<MailboxFull, Schema.Struct<{
    readonly _tag: Schema.tag<"MailboxFull">;
    readonly address: typeof EntityAddress;
}>, Cause.YieldableError>;
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
export declare class MailboxFull extends MailboxFull_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Returns `true` when the value is a `MailboxFull` error.
     *
     * @since 4.0.0
     */
    static is(u: unknown): u is MailboxFull;
}
declare const AlreadyProcessingMessage_base: Schema.Class<AlreadyProcessingMessage, Schema.Struct<{
    readonly _tag: Schema.tag<"AlreadyProcessingMessage">;
    readonly envelopeId: SnowflakeFromString;
    readonly address: typeof EntityAddress;
}>, Cause.YieldableError>;
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
export declare class AlreadyProcessingMessage extends AlreadyProcessingMessage_base {
    /**
     * Marks this value as a cluster error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/ClusterError";
    /**
     * Returns `true` when the value is an `AlreadyProcessingMessage` error.
     *
     * @since 4.0.0
     */
    static is(u: unknown): u is AlreadyProcessingMessage;
}
export {};
//# sourceMappingURL=ClusterError.d.ts.map