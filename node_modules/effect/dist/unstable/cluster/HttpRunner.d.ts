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
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import type { Scope } from "../../Scope.ts";
import * as HttpClient from "../http/HttpClient.ts";
import * as HttpRouter from "../http/HttpRouter.ts";
import type * as HttpServer from "../http/HttpServer.ts";
import type { HttpServerRequest } from "../http/HttpServerRequest.ts";
import type { HttpServerResponse } from "../http/HttpServerResponse.ts";
import * as RpcSerialization from "../rpc/RpcSerialization.ts";
import * as Socket from "../socket/Socket.ts";
import type { MessageStorage } from "./MessageStorage.ts";
import type { RunnerHealth } from "./RunnerHealth.ts";
import * as Runners from "./Runners.ts";
import { RpcClientProtocol } from "./Runners.ts";
import type { RunnerStorage } from "./RunnerStorage.ts";
import * as Sharding from "./Sharding.ts";
import type * as ShardingConfig from "./ShardingConfig.ts";
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
export declare const layerClientProtocolHttp: (options: {
    readonly path: string;
    readonly https?: boolean | undefined;
}) => Layer.Layer<RpcClientProtocol, never, RpcSerialization.RpcSerialization | HttpClient.HttpClient>;
/**
 * Default HTTP runner client protocol layer using path `/`.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerClientProtocolHttpDefault: Layer.Layer<Runners.RpcClientProtocol, never, RpcSerialization.RpcSerialization | HttpClient.HttpClient>;
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
export declare const layerClientProtocolWebsocket: (options: {
    readonly path: string;
    readonly https?: boolean | undefined;
}) => Layer.Layer<RpcClientProtocol, never, RpcSerialization.RpcSerialization | Socket.WebSocketConstructor>;
/**
 * Default WebSocket runner client protocol layer using path `/`.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerClientProtocolWebsocketDefault: Layer.Layer<Runners.RpcClientProtocol, never, RpcSerialization.RpcSerialization | Socket.WebSocketConstructor>;
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
export declare const toHttpEffect: Effect.Effect<Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>, never, Scope | RpcSerialization.RpcSerialization | Sharding.Sharding | MessageStorage>;
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
export declare const toHttpEffectWebsocket: Effect.Effect<Effect.Effect<HttpServerResponse, never, Scope | HttpServerRequest>, never, Scope | RpcSerialization.RpcSerialization | Sharding.Sharding | MessageStorage>;
/**
 * Layer that provides `Sharding` and `Runners` using the configured runner RPC
 * client protocol and storage services.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerClient: Layer.Layer<Sharding.Sharding | Runners.Runners, never, ShardingConfig.ShardingConfig | Runners.RpcClientProtocol | MessageStorage | RunnerStorage | RunnerHealth>;
/**
 * Layer that adds HTTP runner routes to the provided `HttpRouter`.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerHttpOptions: (options: {
    readonly path: HttpRouter.PathInput;
}) => Layer.Layer<Sharding.Sharding | Runners.Runners, never, RunnerStorage | RunnerHealth | RpcSerialization.RpcSerialization | MessageStorage | ShardingConfig.ShardingConfig | Runners.RpcClientProtocol | HttpRouter.HttpRouter>;
/**
 * Layer that adds WebSocket runner routes to the provided `HttpRouter`.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerWebsocketOptions: (options: {
    readonly path: HttpRouter.PathInput;
}) => Layer.Layer<Sharding.Sharding | Runners.Runners, never, ShardingConfig.ShardingConfig | Runners.RpcClientProtocol | MessageStorage | RunnerStorage | RunnerHealth | RpcSerialization.RpcSerialization | HttpRouter.HttpRouter>;
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
export declare const layerHttp: Layer.Layer<Sharding.Sharding | Runners.Runners, never, RpcSerialization.RpcSerialization | ShardingConfig.ShardingConfig | HttpClient.HttpClient | HttpServer.HttpServer | MessageStorage | RunnerStorage | RunnerHealth>;
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
export declare const layerHttpClientOnly: Layer.Layer<Sharding.Sharding | Runners.Runners, never, RpcSerialization.RpcSerialization | ShardingConfig.ShardingConfig | HttpClient.HttpClient | MessageStorage | RunnerStorage>;
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
export declare const layerWebsocket: Layer.Layer<Sharding.Sharding | Runners.Runners, never, RpcSerialization.RpcSerialization | ShardingConfig.ShardingConfig | Socket.WebSocketConstructor | HttpServer.HttpServer | MessageStorage | RunnerStorage | RunnerHealth>;
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
export declare const layerWebsocketClientOnly: Layer.Layer<Sharding.Sharding | Runners.Runners, never, ShardingConfig.ShardingConfig | MessageStorage | RunnerStorage | RpcSerialization.RpcSerialization | Socket.WebSocketConstructor>;
//# sourceMappingURL=HttpRunner.d.ts.map