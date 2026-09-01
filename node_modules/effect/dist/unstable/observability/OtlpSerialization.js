/**
 * Serializes OTLP payloads into HTTP request bodies.
 *
 * Signal exporters build trace, metric, and log data structures in memory. This
 * module provides the service that turns those structures into JSON or protobuf
 * HTTP bodies before they are posted to an OTLP collector.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Layer from "../../Layer.js";
import * as HttpBody from "../http/HttpBody.js";
import * as otlpProtobuf from "./internal/otlpProtobuf.js";
/**
 * Service for serializing OTLP traces, metrics, and logs into HTTP request
 * bodies.
 *
 * @category services
 * @since 4.0.0
 */
export class OtlpSerialization extends /*#__PURE__*/Context.Service()("effect/observability/OtlpSerialization") {}
/**
 * Provides `OtlpSerialization` using OTLP/HTTP JSON bodies.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerJson = /*#__PURE__*/Layer.succeed(OtlpSerialization, {
  traces: spans => HttpBody.jsonUnsafe(spans),
  metrics: metrics => HttpBody.jsonUnsafe(metrics),
  logs: logs => HttpBody.jsonUnsafe(logs)
});
/**
 * Provides `OtlpSerialization` using protobuf-encoded OTLP bodies with the
 * `application/x-protobuf` content type.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerProtobuf = /*#__PURE__*/Layer.succeed(OtlpSerialization, {
  traces: spans => HttpBody.uint8Array(otlpProtobuf.encodeTracesData(spans), "application/x-protobuf"),
  metrics: metrics => HttpBody.uint8Array(otlpProtobuf.encodeMetricsData(metrics), "application/x-protobuf"),
  logs: logs => HttpBody.uint8Array(otlpProtobuf.encodeLogsData(logs), "application/x-protobuf")
});
//# sourceMappingURL=OtlpSerialization.js.map