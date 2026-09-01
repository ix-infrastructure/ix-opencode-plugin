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
import * as Layer from "../../Layer.js";
import * as MessageStorage from "./MessageStorage.js";
import * as RunnerHealth from "./RunnerHealth.js";
import * as Runners from "./Runners.js";
import * as RunnerStorage from "./RunnerStorage.js";
import * as Sharding from "./Sharding.js";
import * as ShardingConfig from "./ShardingConfig.js";
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
export const layer = /*#__PURE__*/Sharding.layer.pipe(/*#__PURE__*/Layer.provideMerge(Runners.layerNoop), /*#__PURE__*/Layer.provideMerge(MessageStorage.layerMemory), /*#__PURE__*/Layer.provide([RunnerStorage.layerMemory, RunnerHealth.layerNoop]), /*#__PURE__*/Layer.provide(/*#__PURE__*/ShardingConfig.layer()));
//# sourceMappingURL=TestRunner.js.map