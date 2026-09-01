/**
 * Checks whether cluster runners should be treated as alive.
 *
 * `RunnerHealth` is used by sharding when deciding whether assigned shards can
 * stay on a runner or need to move elsewhere. This module includes the
 * health-check service, a no-op layer that always reports runners as alive, a
 * ping-based checker, and a Kubernetes-based checker that looks at pod readiness
 * for the runner host.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Layer from "../../Layer.js";
import * as Schedule from "../../Schedule.js";
import * as K8s from "./K8sHttpClient.js";
import * as Runners from "./Runners.js";
/**
 * Represents the service used to check if a Runner is healthy.
 *
 * **Details**
 *
 * If a Runner is responsive, shards will not be re-assigned because the Runner may
 * still be processing messages. If a Runner is not responsive, then its
 * associated shards can and will be re-assigned to a different Runner.
 *
 * @category models
 * @since 4.0.0
 */
export class RunnerHealth extends /*#__PURE__*/Context.Service()("effect/cluster/RunnerHealth") {}
/**
 * Layer that always considers a runner healthy.
 *
 * **When to use**
 *
 * Use when you need a runner-health layer for tests or local development where
 * active health checks are unnecessary.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerNoop = /*#__PURE__*/Layer.succeed(RunnerHealth, {
  isAlive: () => Effect.succeed(true)
});
/**
 * Creates a `RunnerHealth` service that pings runners through `Runners`, retrying
 * failed pings on a short schedule and treating a successful ping within the
 * timeout as healthy.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makePing = /*#__PURE__*/Effect.gen(function* () {
  const runners = yield* Runners.Runners;
  const schedule = Schedule.spaced(500);
  function isAlive(address) {
    return runners.ping(address).pipe(Effect.timeout(10_000), Effect.retry({
      times: 5,
      schedule
    }), Effect.isSuccess);
  }
  return RunnerHealth.of({
    isAlive
  });
});
/**
 * Layer that pings runners directly to check whether they are healthy.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerPing = /*#__PURE__*/Layer.effect(RunnerHealth, makePing);
/**
 * Creates a `RunnerHealth` service that checks Kubernetes pod readiness for a
 * runner host, optionally scoped by namespace and label selector.
 *
 * **Gotchas**
 *
 * If the Kubernetes API check fails, the runner is treated as healthy.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeK8s = /*#__PURE__*/Effect.fnUntraced(function* (options) {
  const allPods = yield* K8s.makeGetPods(options);
  return RunnerHealth.of({
    isAlive: address => allPods.pipe(Effect.map(pods => pods.get(address.host)?.isReadyOrInitializing ?? false), Effect.catchCause(() => Effect.succeed(true)))
  });
});
/**
 * Layer that checks Kubernetes pod readiness to determine whether a runner is
 * healthy.
 *
 * **Details**
 *
 * The provided `HttpClient` must trust the pod CA certificate and the pod service
 * account must be allowed to list pods.
 *
 * **Gotchas**
 *
 * If the Kubernetes API check fails, the runner is treated as healthy.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerK8s = options => Layer.effect(RunnerHealth, makeK8s(options));
//# sourceMappingURL=RunnerHealth.js.map