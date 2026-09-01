/**
 * The `EntityAddress` module defines the value used to locate an entity within
 * a cluster. An address combines the entity type, entity id, and shard id so
 * messages, persisted envelopes, workflow executions, and entity managers can
 * agree on the same routing target.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts";
import * as Hash from "../../Hash.ts";
import * as Schema from "../../Schema.ts";
import { EntityId } from "./EntityId.ts";
import { EntityType } from "./EntityType.ts";
import { ShardId } from "./ShardId.ts";
declare const TypeId = "~effect/cluster/EntityAddress";
declare const EntityAddress_base: Schema.Class<EntityAddress, Schema.Struct<{
    readonly shardId: Schema.declare<ShardId, ShardId>;
    readonly entityType: Schema.brand<Schema.String, "~effect/cluster/EntityType">;
    readonly entityId: Schema.brand<Schema.String, "~effect/cluster/EntityId">;
}>, {}>;
/**
 * Represents the unique address of an entity within the cluster.
 *
 * @category models
 * @since 4.0.0
 */
export declare class EntityAddress extends EntityAddress_base {
    /**
     * Marks this value as a cluster entity address for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/EntityAddress";
    /**
     * Formats the entity type, entity id, and shard id as a readable address.
     *
     * @since 4.0.0
     */
    toString(): string;
    /**
     * Compares entity addresses by entity type, entity id, and shard id.
     *
     * @since 4.0.0
     */
    [Equal.symbol](that: EntityAddress): boolean;
    /**
     * Computes a structural hash from the entity type, entity id, and shard id.
     *
     * @since 4.0.0
     */
    [Hash.symbol](): number;
}
/**
 * Constructs an `EntityAddress` from a shard ID, entity type, and entity ID.
 *
 * **When to use**
 *
 * Use to create the routing target for a known entity type and entity id after
 * resolving that id to the `ShardId` assigned by the entity's shard group.
 *
 * **Details**
 *
 * The returned `EntityAddress` stores the supplied `shardId`, `entityType`, and
 * `entityId`. Equality and hashing include all three fields.
 *
 * **Gotchas**
 *
 * `make` does not choose the shard for an entity. Use the same shard group
 * logic as the entity definition; a different `shardId` makes a different
 * address even when the entity type and entity id match.
 *
 * @see {@link EntityAddress} for the equality, hashing, and string formatting behavior of constructed addresses
 * @see {@link ShardId} for the shard identifier included in the address
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: (options: {
    readonly shardId: ShardId;
    readonly entityType: EntityType;
    readonly entityId: EntityId;
}) => EntityAddress;
export {};
//# sourceMappingURL=EntityAddress.d.ts.map