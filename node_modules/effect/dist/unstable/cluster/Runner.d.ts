/**
 * Cluster runner metadata for processes that can host entity shards.
 *
 * A `Runner` combines the stable `RunnerAddress` used to contact a process, the
 * shard groups that process participates in, and the relative weight used when
 * the sharding service distributes shards across healthy runners.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts";
import * as Hash from "../../Hash.ts";
import { NodeInspectSymbol } from "../../Inspectable.ts";
import * as Schema from "../../Schema.ts";
import { RunnerAddress } from "./RunnerAddress.ts";
declare const TypeId = "~effect/cluster/Runner";
declare const Runner_base: Schema.Class<Runner, Schema.Struct<{
    readonly address: typeof RunnerAddress;
    readonly groups: Schema.$Array<Schema.String>;
    readonly weight: Schema.Number;
}>, {}>;
/**
 * Represents a cluster runner that can host entities.
 *
 * **Details**
 *
 * Each runner has a unique network `address`, the shard `groups` it participates
 * in, and a relative `weight` used when assigning shards across runners.
 *
 * @category models
 * @since 4.0.0
 */
export declare class Runner extends Runner_base {
    /**
     * Formatter for rendering runner values consistently.
     *
     * @since 4.0.0
     */
    static format: import("../../Formatter.ts").Formatter<Runner, string>;
    /**
     * Marks this value as a cluster runner for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/Runner";
    /**
     * Decodes a runner from its JSON string representation.
     *
     * @since 4.0.0
     */
    static readonly decodeSync: (input: string, options?: import("../../SchemaAST.ts").ParseOptions) => Runner;
    /**
     * Encodes a runner to its JSON string representation.
     *
     * @since 4.0.0
     */
    static readonly encodeSync: (input: Runner, options?: import("../../SchemaAST.ts").ParseOptions) => string;
    /**
     * Formats this runner as a string.
     *
     * @since 4.0.0
     */
    toString(): string;
    /**
     * Formats this runner for Node.js inspection.
     *
     * @since 4.0.0
     */
    [NodeInspectSymbol](): string;
    /**
     * Compares runners by address and shard-assignment weight.
     *
     * @since 4.0.0
     */
    [Equal.symbol](that: Runner): boolean;
    /**
     * Computes a structural hash from the runner address and shard-assignment weight.
     *
     * @since 4.0.0
     */
    [Hash.symbol](): number;
}
/**
 * Constructs a `Runner` from its network address, shard groups, and relative
 * shard-assignment weight.
 *
 * **When to use**
 *
 * Use to build runner metadata from an existing `RunnerAddress`, shard groups,
 * and relative weight when registering or exchanging a cluster runner.
 *
 * **Details**
 *
 * The `groups` array lists the shard groups the runner can host. During shard
 * assignment, the runner's address is added to each group's hash ring with
 * `weight` as its relative weight.
 *
 * **Gotchas**
 *
 * This helper constructs the value without runtime schema validation, so only
 * pass trusted `RunnerAddress`, `groups`, and `weight` values.
 *
 * @see {@link Runner} for the value created by this helper
 * @see {@link RunnerAddress} for the network address accepted in `props.address`
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: (props: {
    readonly address: RunnerAddress;
    readonly groups: ReadonlyArray<string>;
    readonly weight: number;
}) => Runner;
export {};
//# sourceMappingURL=Runner.d.ts.map