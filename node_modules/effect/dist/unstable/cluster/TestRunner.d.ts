/**
 * The `TestRunner` module assembles the smallest cluster runtime useful in
 * tests: `Sharding` backed by in-memory message storage, in-memory runner
 * storage, no-op runner transport, and always-healthy runner checks. It lets
 * code that depends on cluster services exercise registration, shard
 * coordination, and mailbox persistence without starting RPC servers or
 * external databases.
 *
 * @since 4.0.0
 */
import * as Layer from "../../Layer.ts";
import * as MessageStorage from "./MessageStorage.ts";
import * as Runners from "./Runners.ts";
import * as Sharding from "./Sharding.ts";
/**
 * Layer that provides an in-memory cluster for testing.
 *
 * **Details**
 *
 * `MessageStorage` and `RunnerStorage` are backed by in-memory drivers.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layer: Layer.Layer<Sharding.Sharding | Runners.Runners | MessageStorage.MessageStorage | MessageStorage.MemoryDriver>;
//# sourceMappingURL=TestRunner.d.ts.map