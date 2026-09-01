/**
 * HTTP client support for talking to the Kubernetes API from code running
 * inside a cluster. The module builds a `K8sHttpClient` service on top of the
 * shared HTTP client, points requests at the in-cluster API endpoint, and uses
 * the mounted service-account token when one is available.
 *
 * @since 4.0.0
 */
import type * as v1 from "kubernetes-types/core/v1.d.ts";
import * as Context from "../../Context.ts";
import * as Effect from "../../Effect.ts";
import * as FileSystem from "../../FileSystem.ts";
import * as Layer from "../../Layer.ts";
import * as Schema from "../../Schema.ts";
import * as HttpClient from "../http/HttpClient.ts";
import * as HttpClientError from "../http/HttpClientError.ts";
declare const K8sHttpClient_base: Context.ServiceClass<K8sHttpClient, "effect/cluster/K8sHttpClient", HttpClient.HttpClient>;
/**
 * Service tag for the HTTP client used to call the Kubernetes API.
 *
 * @category services
 * @since 4.0.0
 */
export declare class K8sHttpClient extends K8sHttpClient_base {
}
/**
 * Layer that configures `K8sHttpClient` for the in-cluster Kubernetes API.
 *
 * **Details**
 *
 * It targets `https://kubernetes.default.svc/api`, adds the service-account
 * bearer token when available, requires successful HTTP statuses, and retries
 * transient failures.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layer: Layer.Layer<K8sHttpClient, never, HttpClient.HttpClient | FileSystem.FileSystem>;
/**
 * Creates a cached effect that fetches running Kubernetes pods.
 *
 * **Details**
 *
 * The request can be limited by namespace and label selector, and the result is a
 * map keyed by pod IP address.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makeGetPods: (options?: {
    readonly namespace?: string | undefined;
    readonly labelSelector?: string | undefined;
} | undefined) => Effect.Effect<Effect.Effect<Map<string, Pod>, HttpClientError.HttpClientError | Schema.SchemaError, never>, never, K8sHttpClient>;
/**
 * Creates a scoped function that ensures a Kubernetes pod exists and waits until
 * it is ready.
 *
 * **Details**
 *
 * The pod defaults to the `default` namespace and is deleted when the surrounding
 * scope closes.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makeCreatePod: Effect.Effect<(spec: v1.Pod) => Effect.Effect<PodStatus, never, import("../../Scope.ts").Scope>, never, K8sHttpClient>;
declare const PodStatus_base: Schema.Class<PodStatus, Schema.Struct<{
    readonly phase: Schema.String;
    readonly conditions: Schema.$Array<Schema.Struct<{
        readonly type: Schema.String;
        readonly status: Schema.String;
        readonly lastTransitionTime: Schema.NullOr<Schema.String>;
    }>>;
    readonly podIP: Schema.String;
    readonly hostIP: Schema.String;
}>, {}>;
/**
 * Schema for the subset of Kubernetes Pod status used by cluster helpers.
 *
 * @category schemas
 * @since 4.0.0
 */
export declare class PodStatus extends PodStatus_base {
}
declare const Pod_base: Schema.Class<Pod, Schema.Struct<{
    readonly status: typeof PodStatus;
}>, {}>;
/**
 * Schema for Kubernetes Pod values used by cluster helpers.
 *
 * **Details**
 *
 * The model exposes readiness helpers derived from the pod status conditions.
 *
 * @category schemas
 * @since 4.0.0
 */
export declare class Pod extends Pod_base {
    get isReady(): boolean;
    get isReadyOrInitializing(): boolean;
}
export {};
//# sourceMappingURL=K8sHttpClient.d.ts.map