/**
 * Connects typed RPC clients to atoms.
 *
 * The service created here exposes a flattened RPC client plus atom-based query
 * and mutation helpers. Query atoms call RPCs and track asynchronous or
 * streaming results, while mutations run RPC calls that can invalidate
 * reactivity keys after success. Query atoms can also use request headers,
 * time-to-live settings, and serialization keys for hydration.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Duration from "../../Duration.ts";
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import type { ReadonlyRecord } from "../../Record.ts";
import type { Scope } from "../../Scope.ts";
import type { NoInfer } from "../../Types.ts";
import * as Headers from "../http/Headers.ts";
import type * as Rpc from "../rpc/Rpc.ts";
import * as RpcClient from "../rpc/RpcClient.ts";
import { RpcClientError } from "../rpc/RpcClientError.ts";
import type * as RpcGroup from "../rpc/RpcGroup.ts";
import type { RequestId } from "../rpc/RpcMessage.ts";
import * as RpcSchema from "../rpc/RpcSchema.ts";
import * as AsyncResult from "./AsyncResult.ts";
import * as Atom from "./Atom.ts";
/**
 * A `Context.Service` for a flattened RPC client integrated with atom reactivity.
 *
 * **Details**
 *
 * It exposes the RPC client, an atom runtime, mutation helpers that return `AtomResultFn`s, and query helpers that
 * return atoms or pull atoms for RPC results.
 *
 * @category models
 * @since 4.0.0
 */
export interface AtomRpcClient<Self, Id extends string, Rpcs extends Rpc.Any> extends Context.Service<Self, RpcClient.RpcClient.Flat<Rpcs, RpcClientError>> {
    new (_: never): Context.ServiceClass.Shape<Id, RpcClient.RpcClient.Flat<Rpcs, RpcClientError>>;
    readonly runtime: Atom.AtomRuntime<Self>;
    readonly mutation: <Tag extends Rpc.Tag<Rpcs>>(arg: Tag) => Rpc.ExtractTag<Rpcs, Tag> extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer _Middleware, infer _Requires> ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? never : Atom.AtomResultFn<{
        readonly payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>;
        readonly reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined;
        readonly headers?: Headers.Input | undefined;
    }, _Success["Type"], _Error["Type"] | RpcClientError | _Middleware["error"]["Type"]> : never;
    readonly query: <Tag extends Rpc.Tag<Rpcs>>(tag: Tag, payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>, options?: {
        readonly headers?: Headers.Input | undefined;
        readonly reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined;
        readonly timeToLive?: Duration.Input | undefined;
        readonly serializationKey?: string | undefined;
    }) => Rpc.ExtractTag<Rpcs, Tag> extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer _Middleware> ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? Atom.Writable<Atom.PullResult<_A["Type"], _E["Type"] | _Error["Type"] | RpcClientError | _Middleware["error"]["Type"]>, void> : Atom.Atom<AsyncResult.AsyncResult<_Success["Type"], _Error["Type"] | RpcClientError | _Middleware["error"]["Type"]>> : never;
}
declare global {
    interface ErrorConstructor {
        stackTraceLimit: number;
    }
}
/**
 * Creates a `Context.Service` class for an RPC client backed by an atom runtime.
 *
 * **Details**
 *
 * The options provide the RPC group, protocol layer, tracing options, request id generation, optional custom client
 * effect, and runtime factory used by the query and mutation helpers.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const Service: <Self>() => <const Id extends string, Rpcs extends Rpc.Any, ER, RM = RpcClient.Protocol | Rpc.MiddlewareClient<NoInfer<Rpcs>> | Rpc.ServicesClient<NoInfer<Rpcs>>>(id: Id, options: {
    readonly group: RpcGroup.RpcGroup<Rpcs>;
    readonly protocol: Layer.Layer<Exclude<NoInfer<RM>, Scope>, ER> | ((get: Atom.AtomContext) => Layer.Layer<Exclude<NoInfer<RM>, Scope>, ER>);
    readonly spanPrefix?: string | undefined;
    readonly spanAttributes?: Record<string, unknown> | undefined;
    readonly generateRequestId?: (() => RequestId) | undefined;
    readonly disableTracing?: boolean | undefined;
    readonly makeEffect?: Effect.Effect<RpcClient.RpcClient.Flat<Rpcs, RpcClientError>, never, RM> | undefined;
    readonly runtime?: Atom.RuntimeFactory | undefined;
}) => AtomRpcClient<Self, Id, Rpcs>;
//# sourceMappingURL=AtomRpc.d.ts.map