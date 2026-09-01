/**
 * Connects cluster runner RPCs to HTTP and WebSocket transports.
 *
 * Runner nodes communicate through the `Runners.Rpcs` protocol. This module
 * provides client protocol layers for dialing runner addresses over HTTP or
 * WebSocket, HTTP effects that serve runner RPC handlers, route layers for
 * installing runner endpoints into an `HttpRouter`, and ready-made layers for
 * HTTP or WebSocket runner communication.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js";
import * as Layer from "../../Layer.js";
import * as HttpClient from "../http/HttpClient.js";
import * as HttpClientRequest from "../http/HttpClientRequest.js";
import * as HttpRouter from "../http/HttpRouter.js";
import * as RpcClient from "../rpc/RpcClient.js";
import * as RpcSerialization from "../rpc/RpcSerialization.js";
import * as RpcServer from "../rpc/RpcServer.js";
import * as Socket from "../socket/Socket.js";
import * as Runners from "./Runners.js";
import { RpcClientProtocol } from "./Runners.js";
import * as RunnerServer from "./RunnerServer.js";
import * as Sharding from "./Sharding.js";
/**
 * Provides a runner RPC client protocol that connects to runner addresses over
 * HTTP.
 *
 * **Details**
 *
 * The configured path is appended to each runner address, and `https` switches
 * the generated URL from `http` to `https`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerClientProtocolHttp = options => Layer.effect(RpcClientProtocol)(Effect.gen(function* () {
  const serialization = yield* RpcSerialization.RpcSerialization;
  const client = yield* HttpClient.HttpClient;
  const https = options.https ?? false;
  return address => {
    const clientWithUrl = HttpClient.mapRequest(client, HttpClientRequest.prependUrl(`http${https ? "s" : ""}://${address.host}:${address.port}/${options.path}`));
    return RpcClient.makeProtocolHttp(clientWithUrl).pipe(Effect.provideService(RpcSerialization.RpcSerialization, serialization));
  };
}));
/**
 * Default HTTP runner client protocol layer using path `/`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerClientProtocolHttpDefault = /*#__PURE__*/layerClientProtocolHttp({
  path: "/"
});
/**
 * Provides a runner RPC client protocol that connects to runner addresses over
 * WebSocket.
 *
 * **Details**
 *
 * The configured path is appended to each runner address, and `https` switches
 * the generated URL from `ws` to `wss`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerClientProtocolWebsocket = options => Layer.effect(RpcClientProtocol)(Effect.gen(function* () {
  const serialization = yield* RpcSerialization.RpcSerialization;
  const https = options.https ?? false;
  const constructor = yield* Socket.WebSocketConstructor;
  return Effect.fnUntraced(function* (address) {
    const socket = yield* Socket.makeWebSocket(`ws${https ? "s" : ""}://${address.host}:${address.port}/${options.path}`).pipe(Effect.provideService(Socket.WebSocketConstructor, constructor));
    return yield* RpcClient.makeProtocolSocket().pipe(Effect.provideService(Socket.Socket, socket), Effect.provideService(RpcSerialization.RpcSerialization, serialization));
  });
}));
/**
 * Default WebSocket runner client protocol layer using path `/`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerClientProtocolWebsocketDefault = /*#__PURE__*/layerClientProtocolWebsocket({
  path: "/"
});
/**
 * Builds an HTTP effect that serves runner RPCs over the HTTP protocol.
 *
 * **Details**
 *
 * The returned effect is produced from `RunnerServer.layerHandlers` and the
 * cluster runner RPC group.
 *
 * @category http app
 * @since 4.0.0
 */
export const toHttpEffect = /*#__PURE__*/Effect.gen(function* () {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers);
  return yield* RpcServer.toHttpEffect(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(Effect.provideContext(handlers));
});
/**
 * Builds an HTTP effect that serves runner RPCs over WebSocket.
 *
 * **Details**
 *
 * The returned effect is produced from `RunnerServer.layerHandlers` and the
 * cluster runner RPC group.
 *
 * @category http app
 * @since 4.0.0
 */
export const toHttpEffectWebsocket = /*#__PURE__*/Effect.gen(function* () {
  const handlers = yield* Layer.build(RunnerServer.layerHandlers);
  return yield* RpcServer.toHttpEffectWebsocket(Runners.Rpcs, {
    spanPrefix: "RunnerServer",
    disableTracing: true
  }).pipe(Effect.provideContext(handlers));
});
/**
 * Layer that provides `Sharding` and `Runners` using the configured runner RPC
 * client protocol and storage services.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerClient = /*#__PURE__*/Sharding.layer.pipe(/*#__PURE__*/Layer.provideMerge(Runners.layerRpc));
/**
 * Layer that adds HTTP runner routes to the provided `HttpRouter`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerHttpOptions = options => RunnerServer.layerWithClients.pipe(Layer.provide(RpcServer.layerProtocolHttp(options)));
/**
 * Layer that adds WebSocket runner routes to the provided `HttpRouter`.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerWebsocketOptions = options => RunnerServer.layerWithClients.pipe(Layer.provide(RpcServer.layerProtocolWebsocket(options)));
/**
 * Layer that serves runner routes at `/` and configures HTTP runner clients.
 *
 * **Details**
 *
 * It serves runner routes at `/` and configures runner clients to communicate
 * over HTTP.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerHttp = /*#__PURE__*/HttpRouter.serve(layerHttpOptions({
  path: "/"
})).pipe(/*#__PURE__*/Layer.provide(layerClientProtocolHttpDefault));
/**
 * Provides a client-only HTTP runner layer.
 *
 * **When to use**
 *
 * Use to provide runner clients over HTTP from a process that should not serve
 * runner routes.
 *
 * **Details**
 *
 * It configures runner clients to communicate over HTTP without serving runner
 * HTTP routes.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerHttpClientOnly = /*#__PURE__*/RunnerServer.layerClientOnly.pipe(/*#__PURE__*/Layer.provide(layerClientProtocolHttpDefault));
/**
 * Layer that serves runner routes at `/` and configures WebSocket runner clients.
 *
 * **Details**
 *
 * It serves runner routes at `/` and configures runner clients to communicate
 * over WebSocket.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerWebsocket = /*#__PURE__*/HttpRouter.serve(layerWebsocketOptions({
  path: "/"
})).pipe(/*#__PURE__*/Layer.provide(layerClientProtocolWebsocketDefault));
/**
 * Provides a client-only WebSocket runner layer.
 *
 * **When to use**
 *
 * Use to provide runner clients over WebSocket from a process that should not
 * serve runner routes.
 *
 * **Details**
 *
 * It configures runner clients to communicate over WebSocket without serving
 * runner WebSocket routes.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerWebsocketClientOnly = /*#__PURE__*/RunnerServer.layerClientOnly.pipe(/*#__PURE__*/Layer.provide(layerClientProtocolWebsocketDefault));
//# sourceMappingURL=HttpRunner.js.map