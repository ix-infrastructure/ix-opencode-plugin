/**
 * The `SingletonAddress` module models the runtime address assigned to a cluster
 * singleton registration. The address pairs the singleton `name` with the
 * `ShardId` selected from that name and its shard group, giving sharding one
 * stable value for registration events, equality, hashing, and local singleton
 * fiber tracking.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts";
import * as Hash from "../../Hash.ts";
import * as Schema from "../../Schema.ts";
import { ShardId } from "./ShardId.ts";
declare const TypeId = "~effect/cluster/SingletonAddress";
declare const SingletonAddress_base: Schema.Class<SingletonAddress, Schema.Struct<{
    readonly shardId: Schema.declare<ShardId, ShardId>;
    readonly name: Schema.String;
}>, {}>;
/**
 * Represents the unique address of an singleton within the cluster.
 *
 * @category address
 * @since 4.0.0
 */
export declare class SingletonAddress extends SingletonAddress_base {
    /**
     * Marks this value as a cluster singleton address for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/SingletonAddress";
    /**
     * Computes a structural hash from the singleton name and shard id.
     *
     * @since 4.0.0
     */
    [Hash.symbol](): number;
    /**
     * Compares singleton addresses by name and shard id.
     *
     * @since 4.0.0
     */
    [Equal.symbol](that: SingletonAddress): boolean;
}
export {};
//# sourceMappingURL=SingletonAddress.d.ts.map