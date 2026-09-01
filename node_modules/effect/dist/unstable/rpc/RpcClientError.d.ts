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
import * as Schema from "../../Schema.ts";
import { HttpClientErrorSchema } from "../http/HttpClientError.ts";
declare const TypeId = "~effect/rpc/RpcClientError";
declare const RpcClientDefect_base: Schema.Class<RpcClientDefect, Schema.Struct<{
    readonly _tag: Schema.tag<"RpcClientDefect">;
    readonly message: Schema.String;
    readonly cause: Schema.Defect;
}>, import("../../Cause.ts").YieldableError>;
/**
 * Represents a client-side RPC defect, such as a protocol violation or
 * decoding failure, with a message and original cause.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class RpcClientDefect extends RpcClientDefect_base {
}
declare const RpcClientError_base: Schema.Class<RpcClientError, Schema.Struct<{
    readonly _tag: Schema.tag<"RpcClientError">;
    readonly reason: Schema.Union<readonly [Schema.Union<[typeof import("../workers/WorkerError.ts").WorkerSpawnError, typeof import("../workers/WorkerError.ts").WorkerSendError, typeof import("../workers/WorkerError.ts").WorkerReceiveError, typeof import("../workers/WorkerError.ts").WorkerUnknownError]>, Schema.Union<readonly [typeof import("../socket/Socket.ts").SocketReadError, typeof import("../socket/Socket.ts").SocketWriteError, typeof import("../socket/Socket.ts").SocketOpenError, typeof import("../socket/Socket.ts").SocketCloseError]>, typeof HttpClientErrorSchema, typeof RpcClientDefect]>;
}>, import("../../Cause.ts").YieldableError>;
/**
 * Error wrapper for RPC client failures, including worker, socket, HTTP client,
 * and client protocol defect failures.
 *
 * @category errors
 * @since 4.0.0
 */
export declare class RpcClientError extends RpcClientError_base {
    /**
     * Marks this value as an RPC client error for runtime guards.
     *
     * @since 4.0.0
     */
    readonly [TypeId] = "~effect/rpc/RpcClientError";
    get message(): string;
}
export {};
//# sourceMappingURL=RpcClientError.d.ts.map