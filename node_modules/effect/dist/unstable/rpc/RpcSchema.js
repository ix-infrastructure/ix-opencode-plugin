/**
 * RPC schema markers and interruption annotations.
 *
 * This module contains the small pieces of schema metadata that the RPC
 * declaration, client, server, cluster, and reactivity layers share. It marks
 * streamed responses and annotates interruptions that came from a remote client
 * closing or cancelling a request.
 *
 * @since 4.0.0
 */
import * as Cause from "../../Cause.js";
import * as Context from "../../Context.js";
import { constUndefined } from "../../Function.js";
import * as Option from "../../Option.js";
import * as Predicate from "../../Predicate.js";
import * as Schema from "../../Schema.js";
import * as Stream_ from "../../Stream.js";
const StreamSchemaTypeId = "~effect/rpc/RpcSchema/StreamSchema";
/**
 * Returns `true` when a schema is an RPC stream schema created by
 * `RpcSchema.Stream`.
 *
 * @category streams
 * @since 4.0.0
 */
export function isStreamSchema(schema) {
  return Predicate.hasProperty(schema, StreamSchemaTypeId);
}
/** @internal */
export function getStreamSchemas(schema) {
  return isStreamSchema(schema) ? Option.some({
    success: schema.success,
    error: schema.error
  }) : Option.none();
}
const schema = /*#__PURE__*/Schema.declare(Stream_.isStream);
/**
 * Creates an RPC stream schema from a stream element success schema and stream
 * error schema.
 *
 * @category streams
 * @since 4.0.0
 */
export function Stream(success, error) {
  return Schema.make(schema.ast, {
    [StreamSchemaTypeId]: StreamSchemaTypeId,
    success,
    error
  });
}
/**
 * Annotation that marks interruptions that originate from an RPC client
 * abort.
 *
 * @category Cause annotations
 * @since 4.0.0
 */
export class ClientAbort extends /*#__PURE__*/Context.Service()("effect/rpc/RpcSchema/ClientAbort") {
  static annotation = /*#__PURE__*/this.context(true).pipe(/*#__PURE__*/Context.add(Cause.StackTrace, {
    name: "ClientAbort",
    stack: constUndefined,
    parent: undefined
  }));
}
//# sourceMappingURL=RpcSchema.js.map