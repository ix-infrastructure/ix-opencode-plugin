/**
 * Common model for incoming HTTP messages.
 *
 * `HttpIncomingMessage` is used by server requests and client responses to
 * expose headers, an optional remote address, and body accessors. This module
 * provides decoders for JSON bodies, URL-encoded bodies, and headers, plus the
 * shared body-size setting and inspection helper used by request and response
 * implementations.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import { hasProperty } from "../../Predicate.js";
import { redact } from "../../Redactable.js";
import * as Schema from "../../Schema.js";
import * as UrlParams from "./UrlParams.js";
/**
 * Type identifier for `HttpIncomingMessage` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/http/HttpIncomingMessage";
/**
 * Returns `true` when a value is an `HttpIncomingMessage`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isHttpIncomingMessage = u => hasProperty(u, TypeId);
/**
 * Creates a decoder that reads an incoming message's JSON body and decodes it with the supplied schema.
 *
 * @category schemas
 * @since 4.0.0
 */
export const schemaBodyJson = (schema, options) => {
  const decode = Schema.decodeEffect(Schema.toCodecJson(schema));
  return self => Effect.flatMap(self.json, u => decode(u, options));
};
/**
 * Creates a decoder that reads an incoming message's URL-encoded body parameters and decodes them with the supplied schema.
 *
 * @category schemas
 * @since 4.0.0
 */
export const schemaBodyUrlParams = (schema, options) => {
  const decode = UrlParams.schemaRecord.pipe(Schema.decodeTo(schema), Schema.decodeEffect);
  return self => Effect.flatMap(self.urlParamsBody, u => decode(u, options));
};
/**
 * Creates a decoder that validates and decodes an incoming message's headers with the supplied schema.
 *
 * @category schemas
 * @since 4.0.0
 */
export const schemaHeaders = (schema, options) => {
  const decode = Schema.decodeUnknownEffect(schema);
  return self => decode(self.headers, options);
};
/**
 * Context reference for the optional maximum size allowed when reading an incoming message body.
 *
 * @category references
 * @since 4.0.0
 */
export const MaxBodySize = /*#__PURE__*/Context.Reference("effect/http/HttpIncomingMessage/MaxBodySize", {
  defaultValue: () => undefined
});
/**
 * Builds an inspectable object for an incoming message, redacting headers and including a synchronously readable JSON or text body when available.
 *
 * @category converting
 * @since 4.0.0
 */
export const inspect = (self, that) => {
  const contentType = self.headers["content-type"] ?? "";
  let body;
  if (contentType.includes("application/json")) {
    try {
      body = Effect.runSync(self.json);
      // oxlint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      //
    }
  } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
    try {
      body = Effect.runSync(self.text);
      // oxlint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      //
    }
  }
  const obj = {
    ...that,
    headers: redact(self.headers),
    remoteAddress: self.remoteAddress
  };
  if (body !== undefined) {
    obj.body = body;
  }
  return obj;
};
//# sourceMappingURL=HttpIncomingMessage.js.map