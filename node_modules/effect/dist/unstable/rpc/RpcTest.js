/**
 * In-memory test harness for RPC groups.
 *
 * `RpcTest` connects a generated client directly to `RpcServer` handlers for
 * the same `RpcGroup`. It uses the no-serialization path, so requests,
 * responses, stream chunks, acknowledgements, interrupts, headers, and
 * middleware metadata travel through the normal client/server machinery without
 * opening HTTP, socket, worker, or serializer infrastructure.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js";
import * as RpcClient from "./RpcClient.js";
import * as RpcServer from "./RpcServer.js";
/**
 * Creates an in-memory RPC client for a group, backed by the group's handlers
 * from the environment and using the no-serialization test transport.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeClient = /*#__PURE__*/Effect.fnUntraced(function* (group, options) {
  // oxlint-disable-next-line prefer-const
  let client;
  const server = yield* RpcServer.makeNoSerialization(group, {
    onFromServer(response) {
      return client.write(response);
    }
  });
  client = yield* RpcClient.makeNoSerialization(group, {
    supportsAck: true,
    flatten: options?.flatten,
    onFromClient({
      message
    }) {
      return server.write(0, message);
    }
  });
  return client.client;
});
//# sourceMappingURL=RpcTest.js.map