/**
 * Service contract for servers that accept socket connections.
 *
 * `SocketServer` exposes the bound server `address` and a long-running `run`
 * loop that hands each accepted connection to a handler as a `Socket.Socket`.
 * The module also defines TCP and Unix socket address models plus the
 * server-level errors reported while opening or running a server. Platform
 * layers provide concrete implementations of this service.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Data from "../../Data.js";
/**
 * Context service for a socket server, exposing its bound address and a run
 * loop that handles each accepted `Socket`.
 *
 * @category services
 * @since 4.0.0
 */
export class SocketServer extends /*#__PURE__*/Context.Service()("@effect/platform/SocketServer") {}
/**
 * Runtime type identifier attached to `SocketServerError` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const ErrorTypeId = "@effect/platform/SocketServer/SocketServerError";
/**
 * Error reason for failures that occur while opening a socket server.
 *
 * @category errors
 * @since 4.0.0
 */
export class SocketServerOpenError extends /*#__PURE__*/Data.TaggedError("SocketServerOpenError") {
  get message() {
    return "Open";
  }
}
/**
 * Error reason for uncategorized socket server failures.
 *
 * @category errors
 * @since 4.0.0
 */
export class SocketServerUnknownError extends /*#__PURE__*/Data.TaggedError("SocketServerUnknownError") {
  get message() {
    return "Unknown";
  }
}
/**
 * Tagged socket server error that wraps a server error reason and exposes its
 * cause.
 *
 * @category errors
 * @since 4.0.0
 */
export class SocketServerError extends /*#__PURE__*/Data.TaggedError("SocketServerError") {
  constructor(props) {
    super({
      ...props,
      cause: props.reason.cause
    });
  }
  /**
   * Marks this value as a socket server error for runtime guards.
   *
   * @since 4.0.0
   */
  [ErrorTypeId] = ErrorTypeId;
  /**
   * Delegates the public message to the underlying socket server error reason.
   *
   * @since 4.0.0
   */
  get message() {
    return this.reason.message;
  }
}
//# sourceMappingURL=SocketServer.js.map