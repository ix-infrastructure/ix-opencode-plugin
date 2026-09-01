import * as Config from "../../../Config.js";
import * as Schema from "../../../Schema.js";
import * as SchemaGetter from "../../../SchemaGetter.js";
const ExporterList = /*#__PURE__*/Config.Array(Schema.String).pipe(/*#__PURE__*/Schema.decode({
  decode: /*#__PURE__*/SchemaGetter.transform(_ => _.map(_ => _.toLowerCase().trim()).filter(_ => _ !== "")),
  encode: /*#__PURE__*/SchemaGetter.passthrough()
}));
const HeadersRecord = /*#__PURE__*/Config.Record(Schema.String, Schema.String);
export const headers = signal => Config.schema(HeadersRecord, `OTEL_EXPORTER_OTLP_${signal}_HEADERS`).pipe(Config.orElse(() => Config.schema(HeadersRecord, "OTEL_EXPORTER_OTLP_HEADERS")), Config.withDefault(undefined));
export const endpoint = signal => Config.url(`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`).pipe(Config.orElse(() => Config.url("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(Config.map(url => {
  const slash = url.pathname.endsWith("/") ? "" : "/";
  url.pathname += `${slash}v1/${signal.toLowerCase()}`;
  return url;
}))), Config.withDefault(undefined));
export const exporters = signal => Config.schema(ExporterList, `OTEL_${signal}_EXPORTER`).pipe(Config.withDefault([]));
//# sourceMappingURL=otlpEnv.js.map