/**
 * Single-process cluster layer for durable entities and workflows. It wires
 * `Sharding` with no-op runner communication, no-op runner health checks,
 * SQL-backed message storage, environment-based sharding configuration, and
 * either SQL-backed or in-memory runner storage.
 *
 * This layer is meant for local, embedded, or small single-node setups where the
 * process handles all cluster work itself. It still requires a SQL client
 * because mailbox messages and replies are stored in SQL.
 *
 * @since 4.0.0
 */
import * as Layer from "effect/Layer";
import * as RunnerHealth from "./RunnerHealth.js";
import * as Runners from "./Runners.js";
import * as RunnerStorage from "./RunnerStorage.js";
import * as Sharding from "./Sharding.js";
import * as ShardingConfig from "./ShardingConfig.js";
import * as SqlMessageStorage from "./SqlMessageStorage.js";
import * as SqlRunnerStorage from "./SqlRunnerStorage.js";
/**
 * Provides a SQL-backed single-node cluster for running durable
 * entities and workflows.
 *
 * **When to use**
 *
 * Use to run durable cluster entities and workflows in a local, embedded, or
 * small single-node process while keeping mailbox and reply state in SQL.
 *
 * **Details**
 *
 * The layer provides `Sharding`, `Runners`, and `MessageStorage`. It loads
 * `ShardingConfig` from environment variables and overlays
 * `options.shardingConfig` when provided. Message storage is always SQL-backed;
 * runner storage is SQL-backed by default and switches to in-memory storage
 * when `runnerStorage` is set to `"memory"`.
 *
 * **Gotchas**
 *
 * - Even when `runnerStorage` is `"memory"`, message storage remains
 *   SQL-backed, so callers must still provide `SqlClient`.
 * - Runner communication and runner health are no-op services, so this layer is
 *   for single-process use rather than multi-runner coordination.
 *
 * @see {@link ShardingConfig.layerFromEnv} for loading environment configuration before applying `shardingConfig` overrides
 * @see {@link SqlMessageStorage.layer} for the SQL-backed message storage that this layer provides
 * @see {@link SqlRunnerStorage.layer} for the default SQL-backed runner storage selected when `runnerStorage` is omitted or `"sql"`
 * @see {@link RunnerStorage.layerMemory} for the in-memory runner storage selected by `runnerStorage: "memory"`
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = options => Sharding.layer.pipe(Layer.provideMerge(Runners.layerNoop), Layer.provideMerge(SqlMessageStorage.layer), Layer.provide([options?.runnerStorage === "memory" ? RunnerStorage.layerMemory : Layer.orDie(SqlRunnerStorage.layer), RunnerHealth.layerNoop]), Layer.provide(ShardingConfig.layerFromEnv(options?.shardingConfig)));
//# sourceMappingURL=SingleRunner.js.map