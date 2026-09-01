/**
 * Worker-side primitives for worker-like runtimes.
 *
 * A `WorkerRunner` receives messages tagged by a numeric port id, sends replies
 * back through the same transport, and can expose disconnect notifications. The
 * module also defines the small platform message shape and the
 * `WorkerRunnerPlatform` service that starts a platform-specific runner.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
/**
 * Context service that starts a platform-specific `WorkerRunner`.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerRunnerPlatform extends /*#__PURE__*/Context.Service()("effect/workers/WorkerRunner/WorkerRunnerPlatform") {}
//# sourceMappingURL=WorkerRunner.js.map