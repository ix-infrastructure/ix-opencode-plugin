/**
 * Formats Effect metrics for Prometheus.
 *
 * This module reads metrics from the current Effect context and renders them in
 * the Prometheus text format. It can also register a pull-based HTTP endpoint,
 * such as `/metrics`, for Prometheus to scrape.
 *
 * @since 4.0.0
 */
import type * as Context from "../../Context.ts";
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import * as HttpRouter from "../http/HttpRouter.ts";
/**
 * A function that transforms metric names before formatting.
 *
 * **Example** (Mapping metric names)
 *
 * ```ts
 * import type { PrometheusMetrics } from "effect/unstable/observability"
 *
 * // Convert camelCase to snake_case
 * const mapper: PrometheusMetrics.MetricNameMapper = (name) =>
 *   name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
 * ```
 *
 * @category models
 * @since 4.0.0
 */
export type MetricNameMapper = (name: string) => string;
/**
 * Options for formatting metrics.
 *
 * @category options
 * @since 4.0.0
 */
export interface FormatOptions {
    /**
     * Optional prefix to prepend to all metric names.
     * The prefix will be sanitized and joined with an underscore.
     */
    readonly prefix?: string | undefined;
    /**
     * Optional function to transform metric names before sanitization.
     */
    readonly metricNameMapper?: MetricNameMapper | undefined;
}
/**
 * Options for exporting Prometheus metrics over HTTP.
 *
 * @category options
 * @since 4.0.0
 */
export interface HttpOptions extends FormatOptions {
    /**
     * The path to the HTTP route on which Prometheus metrics should be served.
     */
    readonly path?: HttpRouter.PathInput | undefined;
}
/**
 * Formats all metrics in the registry to Prometheus exposition format.
 *
 * **Example** (Formatting metrics)
 *
 * ```ts
 * import { Effect, Metric } from "effect"
 * import { PrometheusMetrics } from "effect/unstable/observability"
 *
 * const program = Effect.gen(function*() {
 *   const counter = Metric.counter("api_requests_total", {
 *     description: "Total API requests"
 *   })
 *   const gauge = Metric.gauge("active_connections", {
 *     description: "Number of active connections"
 *   })
 *
 *   yield* Metric.update(counter, 100)
 *   yield* Metric.update(gauge, 25)
 *
 *   // Format without prefix
 *   const output1 = yield* PrometheusMetrics.format()
 *
 *   // Format with prefix
 *   const output2 = yield* PrometheusMetrics.format({ prefix: "myapp" })
 * })
 * ```
 *
 * @category formatting
 * @since 4.0.0
 */
export declare const format: (options?: FormatOptions | undefined) => Effect.Effect<string>;
/**
 * Formats all metrics in the registry to Prometheus exposition format synchronously.
 *
 * **When to use**
 *
 * Use when you already have access to the context and need low-level
 * synchronous formatting.
 *
 * @see {@link format} for effectful formatting from the current context
 *
 * @category formatting
 * @since 4.0.0
 */
export declare const formatUnsafe: (context: Context.Context<never>, options?: FormatOptions | undefined) => string;
/**
 * Creates a Layer that registers a `/metrics` HTTP endpoint for Prometheus
 * scraping.
 *
 * **Details**
 *
 * This layer automatically adds a GET route to your HTTP router that serves
 * metrics in Prometheus exposition format. By default, the endpoint is
 * registered at `/metrics`, but this can be customized via the `path` option.
 *
 * **Example** (Serving metrics over HTTP)
 *
 * ```ts
 * import { PrometheusMetrics } from "effect/unstable/observability"
 *
 * // Create a layer that adds /metrics endpoint to the router
 * const PrometheusLayer = PrometheusMetrics.layerHttp()
 *
 * // Or customize the path and add a prefix to all metric names
 * const CustomPrometheusLayer = PrometheusMetrics.layerHttp({
 *   path: "/prometheus/metrics",
 *   prefix: "myapp"
 * })
 * ```
 *
 * @category Http
 * @since 4.0.0
 */
export declare const layerHttp: (options?: HttpOptions | undefined) => Layer.Layer<never, never, HttpRouter.HttpRouter>;
//# sourceMappingURL=PrometheusMetrics.d.ts.map