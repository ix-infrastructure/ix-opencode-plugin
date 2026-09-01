/**
 * Serializes OTLP payloads into HTTP request bodies.
 *
 * Signal exporters build trace, metric, and log data structures in memory. This
 * module provides the service that turns those structures into JSON or protobuf
 * HTTP bodies before they are posted to an OTLP collector.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Layer from "../../Layer.ts";
import * as HttpBody from "../http/HttpBody.ts";
import type { LogsData } from "./OtlpLogger.ts";
import type { MetricsData } from "./OtlpMetrics.ts";
import type { TraceData } from "./OtlpTracer.ts";
declare const OtlpSerialization_base: Context.ServiceClass<OtlpSerialization, "effect/observability/OtlpSerialization", {
    readonly traces: (data: TraceData) => HttpBody.HttpBody;
    readonly metrics: (data: MetricsData) => HttpBody.HttpBody;
    readonly logs: (data: LogsData) => HttpBody.HttpBody;
}>;
/**
 * Service for serializing OTLP traces, metrics, and logs into HTTP request
 * bodies.
 *
 * @category services
 * @since 4.0.0
 */
export declare class OtlpSerialization extends OtlpSerialization_base {
}
/**
 * Provides `OtlpSerialization` using OTLP/HTTP JSON bodies.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerJson: Layer.Layer<OtlpSerialization, never, never>;
/**
 * Provides `OtlpSerialization` using protobuf-encoded OTLP bodies with the
 * `application/x-protobuf` content type.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerProtobuf: Layer.Layer<OtlpSerialization, never, never>;
export {};
//# sourceMappingURL=OtlpSerialization.d.ts.map