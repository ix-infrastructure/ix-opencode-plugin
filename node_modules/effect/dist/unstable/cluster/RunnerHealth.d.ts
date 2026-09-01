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
import * as Context from "../../Context.ts";
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import type * as Scope from "../../Scope.ts";
import * as K8s from "./K8sHttpClient.ts";
import type { RunnerAddress } from "./RunnerAddress.ts";
import * as Runners from "./Runners.ts";
declare const RunnerHealth_base: Context.ServiceClass<RunnerHealth, "effect/cluster/RunnerHealth", {
    readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean>;
}>;
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
export declare class RunnerHealth extends RunnerHealth_base {
}
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
export declare const layerNoop: Layer.Layer<RunnerHealth, never, never>;
/**
 * Creates a `RunnerHealth` service that pings runners through `Runners`, retrying
 * failed pings on a short schedule and treating a successful ping within the
 * timeout as healthy.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makePing: Effect.Effect<RunnerHealth["Service"], never, Runners.Runners | Scope.Scope>;
/**
 * Layer that pings runners directly to check whether they are healthy.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerPing: Layer.Layer<RunnerHealth, never, Runners.Runners>;
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
export declare const makeK8s: (options?: {
    readonly namespace?: string | undefined;
    readonly labelSelector?: string | undefined;
} | undefined) => Effect.Effect<{
    readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean>;
}, never, K8s.K8sHttpClient>;
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
export declare const layerK8s: (options?: {
    readonly namespace?: string | undefined;
    readonly labelSelector?: string | undefined;
} | undefined) => Layer.Layer<RunnerHealth, never, K8s.K8sHttpClient>;
export {};
//# sourceMappingURL=RunnerHealth.d.ts.map