/**
 * Network addresses for locating cluster runners. A `RunnerAddress` stores the
 * host and port for a runner and provides schema support, structural equality,
 * hashing, Node.js inspection, and a stable primary key formatted from the host
 * and port.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts";
import * as Hash from "../../Hash.ts";
import { NodeInspectSymbol } from "../../Inspectable.ts";
import * as PrimaryKey from "../../PrimaryKey.ts";
import * as Schema from "../../Schema.ts";
declare const TypeId = "~effect/cluster/RunnerAddress";
declare const RunnerAddress_base: Schema.Class<RunnerAddress, Schema.Struct<{
    readonly host: Schema.String;
    readonly port: Schema.Number;
}>, {}>;
/**
 * Represents the network address of a cluster runner, identified by host and
 * port.
 *
 * **When to use**
 *
 * Use to represent the host and port that identify a runner in cluster routing,
 * registration, and health checks.
 *
 * @category models
 * @since 4.0.0
 */
export declare class RunnerAddress extends RunnerAddress_base {
    /**
     * Marks this value as a cluster runner address for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/cluster/RunnerAddress";
    /**
     * Compares runner addresses by host and port.
     *
     * @since 4.0.0
     */
    [Equal.symbol](that: RunnerAddress): boolean;
    /**
     * Computes a structural hash from the host and port.
     *
     * @since 4.0.0
     */
    [Hash.symbol](): number;
    /**
     * Stable primary key used to identify the runner address.
     *
     * @since 4.0.0
     */
    [PrimaryKey.symbol](): string;
    /**
     * Formats the runner address with its host and port.
     *
     * @since 4.0.0
     */
    toString(): string;
    /**
     * Formats the runner address for Node.js inspection.
     *
     * @since 4.0.0
     */
    [NodeInspectSymbol](): string;
}
/**
 * Constructs a `RunnerAddress` from a host and port.
 *
 * **When to use**
 *
 * Use to create the stable network identity for a cluster runner when
 * configuring sharding, registering runner metadata, or targeting a runner by
 * host and port.
 *
 * **Details**
 *
 * The returned `RunnerAddress` stores the supplied `host` and `port`. Equality,
 * hashing, and the primary key use both fields, with the primary key formatted
 * as `host:port`.
 *
 * **Gotchas**
 *
 * `make` does not normalize the host. Pass the host string exactly as the
 * cluster routing and storage layers should identify it.
 *
 * @see {@link RunnerAddress} for the constructed address type and its equality, hashing, primary-key, and formatting behavior
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: (host: string, port: number) => RunnerAddress;
export {};
//# sourceMappingURL=RunnerAddress.d.ts.map