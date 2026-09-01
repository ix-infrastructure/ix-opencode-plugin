/**
 * Builds OTLP resource metadata shared by exported telemetry.
 *
 * An OTLP resource describes the service and other attributes attached to every
 * exported log, metric, or trace. This module builds resources from explicit
 * options or OpenTelemetry environment variables and converts JavaScript values
 * into OTLP attribute values.
 *
 * @since 4.0.0
 */
import * as Config from "../../Config.js";
import * as Effect from "../../Effect.js";
import { format } from "../../Formatter.js";
import * as Schema from "../../Schema.js";
/**
 * Creates an OTLP resource from service metadata and additional attributes.
 *
 * **Details**
 *
 * The resource always includes `service.name`, includes `service.version` when
 * provided, and converts custom attributes into OTLP attribute values.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = options => {
  const resourceAttributes = options.attributes ? entriesToAttributes(Object.entries(options.attributes)) : [];
  resourceAttributes.push({
    key: "service.name",
    value: {
      stringValue: options.serviceName
    }
  });
  if (options.serviceVersion) {
    resourceAttributes.push({
      key: "service.version",
      value: {
        stringValue: options.serviceVersion
      }
    });
  }
  return {
    attributes: resourceAttributes,
    droppedAttributesCount: 0
  };
};
/**
 * Creates an OTLP resource from explicit options and OpenTelemetry
 * configuration.
 *
 * **Details**
 *
 * `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME`, and
 * `OTEL_SERVICE_VERSION` override explicit options; missing required
 * configuration is converted to a defect.
 *
 * @category constructors
 * @since 4.0.0
 */
export const fromConfig = /*#__PURE__*/Effect.fnUntraced(function* (options) {
  const env = yield* Config.schema(Schema.UndefinedOr(Config.Record(Schema.String, Schema.String)), "OTEL_RESOURCE_ATTRIBUTES");
  const serviceName = (yield* Config.schema(Schema.UndefinedOr(Schema.String), "OTEL_SERVICE_NAME")) ?? env?.["service.name"] ?? options?.attributes?.["service.name"] ?? options?.serviceName ?? (yield* Config.string("OTEL_SERVICE_NAME"));
  const serviceVersion = (yield* Config.schema(Schema.UndefinedOr(Schema.String), "OTEL_SERVICE_VERSION")) ?? env?.["service.version"] ?? options?.attributes?.["service.version"] ?? options?.serviceVersion;
  const attributes = {
    ...options?.attributes,
    ...env
  };
  delete attributes["service.name"];
  delete attributes["service.version"];
  return make({
    serviceName,
    serviceVersion,
    attributes
  });
}, Effect.orDie);
/**
 * Returns the `service.name` attribute from an OTLP resource.
 *
 * **When to use**
 *
 * Use when an OTLP resource is known to contain a string `service.name` and
 * throwing is acceptable if that invariant is broken.
 *
 * **Gotchas**
 *
 * Throws if the resource does not contain a string `service.name` attribute.
 *
 * @category Attributes
 * @since 4.0.0
 */
export const serviceNameUnsafe = resource => {
  const serviceNameAttribute = resource.attributes.find(attr => attr.key === "service.name");
  if (!serviceNameAttribute || !serviceNameAttribute.value.stringValue) {
    throw new Error("Resource does not contain a service name");
  }
  return serviceNameAttribute.value.stringValue;
};
/**
 * Converts key/value entries into OTLP `KeyValue` attributes.
 *
 * @category Attributes
 * @since 4.0.0
 */
export const entriesToAttributes = entries => {
  const attributes = [];
  for (const [key, value] of entries) {
    attributes.push({
      key,
      value: unknownToAttributeValue(value)
    });
  }
  return attributes;
};
/**
 * Converts an arbitrary JavaScript value into an OTLP `AnyValue`.
 *
 * **Details**
 *
 * Arrays are converted recursively, primitive values use their matching OTLP
 * fields, and unsupported values are formatted as strings.
 *
 * @category Attributes
 * @since 4.0.0
 */
export const unknownToAttributeValue = value => {
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(unknownToAttributeValue)
      }
    };
  }
  switch (typeof value) {
    case "string":
      return {
        stringValue: value
      };
    case "bigint":
      return {
        intValue: Number(value)
      };
    case "number":
      return Number.isInteger(value) ? {
        intValue: value
      } : {
        doubleValue: value
      };
    case "boolean":
      return {
        boolValue: value
      };
    default:
      return {
        stringValue: format(value)
      };
  }
};
//# sourceMappingURL=OtlpResource.js.map