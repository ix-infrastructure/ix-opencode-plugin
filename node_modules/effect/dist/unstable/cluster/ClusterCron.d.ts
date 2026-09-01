/**
 * Runs recurring cron jobs through cluster sharding.
 *
 * This module turns a `Cron.Cron` schedule into a `Layer` that coordinates one
 * recurring job across a cluster. It registers a singleton for the initial
 * scheduling step and a persisted entity message for each run. This is useful
 * for distributed maintenance work where the job should be owned by the cluster
 * rather than by every runner independently.
 *
 * @since 4.0.0
 */
import * as Cron from "../../Cron.ts";
import * as Duration from "../../Duration.ts";
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import type { Scope } from "../../Scope.ts";
import type { Sharding } from "./Sharding.ts";
/**
 * Creates a layer that runs a cron job through the cluster sharding system.
 *
 * **Details**
 *
 * The job is scheduled as persisted entity messages, with an initial singleton
 * scheduling step and optional controls for shard group, next-run calculation,
 * and skipping stale scheduled runs.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: <E, R>(options: {
    readonly name: string;
    readonly cron: Cron.Cron;
    readonly execute: Effect.Effect<void, E, R>;
    /**
     * Choose a shard group to run this cron job on.
     */
    readonly shardGroup?: string | undefined;
    /**
     * Controls whether the next cron job is based on the time of the previous
     * run.
     *
     * **Details**
     *
     * Defaults to `false`, meaning the next run will be calculated from the
     * current time.
     */
    readonly calculateNextRunFromPrevious?: boolean | undefined;
    /**
     * If set, the cron job will skip execution if the scheduled time is older
     * than this duration.
     *
     * **When to use**
     *
     * Use to prevent running jobs that were scheduled too far in the past.
     *
     * **Details**
     *
     * Defaults to "1 day".
     */
    readonly skipIfOlderThan?: Duration.Input | undefined;
}) => Layer.Layer<never, never, Sharding | Exclude<R, Scope>>;
//# sourceMappingURL=ClusterCron.d.ts.map