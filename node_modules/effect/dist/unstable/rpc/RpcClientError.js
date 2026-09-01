/**
 * Client-side protocol failures reported by unstable RPC transports.
 *
 * `RpcClientError` is the error type generated clients use when a call fails
 * before a remote handler can return its declared typed error. Its `reason`
 * covers built-in transport failures from HTTP, sockets, and workers, plus
 * `RpcClientDefect` values for malformed or incompatible protocol data.
 *
 * @since 4.0.0
 */
import * as Schema from "../../Schema.js";
import { HttpClientErrorSchema } from "../http/HttpClientError.js";
import { SocketErrorReason } from "../socket/Socket.js";
import { WorkerErrorReason } from "../workers/WorkerError.js";
const TypeId = "~effect/rpc/RpcClientError";
/**
 * Represents a client-side RPC defect, such as a protocol violation or
 * decoding failure, with a message and original cause.
 *
 * @category errors
 * @since 4.0.0
 */
export class RpcClientDefect extends /*#__PURE__*/Schema.ErrorClass("effect/rpc/RpcClientError/RpcClientDefect")({
  _tag: /*#__PURE__*/Schema.tag("RpcClientDefect"),
  message: Schema.String,
  cause: /*#__PURE__*/Schema.Defect()
}) {}
/**
 * Error wrapper for RPC client failures, including worker, socket, HTTP client,
 * and client protocol defect failures.
 *
 * @category errors
 * @since 4.0.0
 */
export class RpcClientError extends /*#__PURE__*/Schema.ErrorClass(TypeId)({
  _tag: /*#__PURE__*/Schema.tag("RpcClientError"),
  reason: /*#__PURE__*/Schema.Union([WorkerErrorReason, SocketErrorReason, HttpClientErrorSchema, RpcClientDefect])
}) {
  /**
   * Marks this value as an RPC client error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  get message() {
    return `${this.reason._tag}: ${this.reason.message}`;
  }
}
//# sourceMappingURL=RpcClientError.js.map