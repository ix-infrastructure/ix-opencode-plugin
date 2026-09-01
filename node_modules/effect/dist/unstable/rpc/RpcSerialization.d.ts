/**
 * Serializes RPC protocol messages for transports.
 *
 * `RpcSerialization` is the boundary between `RpcMessage` envelopes and the
 * bytes or strings carried by a transport. This module provides built-in
 * serializers for JSON, newline-delimited JSON, JSON-RPC 2.0, and MessagePack,
 * including framed formats that can decode multiple messages from streaming
 * chunks.
 *
 * @since 4.0.0
 */
import * as Msgpackr from "msgpackr";
import * as Context from "../../Context.ts";
import * as Layer from "../../Layer.ts";
declare const RpcSerialization_base: Context.ServiceClass<RpcSerialization, "effect/rpc/RpcSerialization", {
    makeUnsafe(): Parser;
    readonly contentType: string;
    readonly includesFraming: boolean;
}>;
/**
 * Service that describes how RPC protocol messages are encoded and decoded,
 * including the content type and whether the serialization format provides
 * message framing.
 *
 * **When to use**
 *
 * Use to provide the serialization boundary shared by RPC clients and servers
 * for a chosen wire format.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare class RpcSerialization extends RpcSerialization_base {
}
/**
 * A stateful parser for an RPC serialization format, able to decode input
 * chunks into protocol messages and encode messages for transport.
 *
 * @category serialization
 * @since 4.0.0
 */
export interface Parser {
    readonly decode: (data: Uint8Array | string) => ReadonlyArray<unknown>;
    readonly encode: (response: unknown) => Uint8Array | string | undefined;
}
/**
 * JSON RPC serialization for whole message payloads. It does not include
 * message framing, so it is intended for transports that frame responses
 * themselves.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const json: RpcSerialization["Service"];
/**
 * Serializes RPC protocol messages as newline-delimited JSON, framing each message
 * with a trailing newline.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const ndjson: RpcSerialization["Service"];
/**
 * Creates a JSON-RPC 2.0 serialization for RPC protocol messages without
 * additional message framing.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const jsonRpc: (options?: {
    readonly contentType?: string | undefined;
}) => RpcSerialization["Service"];
/**
 * Creates a newline-delimited JSON-RPC 2.0 serialization for RPC protocol
 * messages.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const ndJsonRpc: (options?: {
    readonly contentType?: string | undefined;
}) => RpcSerialization["Service"];
/**
 * Create a MessagePack serialization with custom msgpackr options.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const makeMsgPack: (options?: Msgpackr.Options | undefined) => RpcSerialization["Service"];
/**
 * Default MessagePack RPC serialization using record support and built-in
 * message framing.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const msgPack: RpcSerialization["Service"];
/**
 * RPC serialization layer that uses JSON for serialization.
 *
 * **When to use**
 *
 * Use when you have a transport protocol that already provides message framing.
 *
 * @see {@link layerNdjson} for transports that need newline-delimited framing
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const layerJson: Layer.Layer<RpcSerialization>;
/**
 * RPC serialization layer that uses NDJSON for serialization.
 *
 * **When to use**
 *
 * Use when you have a transport protocol that does not provide message framing.
 *
 * @see {@link layerJson} for transports that already provide message framing
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const layerNdjson: Layer.Layer<RpcSerialization>;
/**
 * RPC serialization layer that uses JSON-RPC for serialization.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const layerJsonRpc: (options?: {
    readonly contentType?: string | undefined;
}) => Layer.Layer<RpcSerialization>;
/**
 * RPC serialization layer that uses newline-delimited JSON-RPC for
 * serialization.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const layerNdJsonRpc: (options?: {
    readonly contentType?: string | undefined;
}) => Layer.Layer<RpcSerialization>;
/**
 * RPC serialization layer that uses MessagePack for serialization.
 *
 * **Details**
 *
 * MessagePack has a more compact binary format compared to JSON and NDJSON. It
 * also has better support for binary data.
 *
 * @category serialization
 * @since 4.0.0
 */
export declare const layerMsgPack: Layer.Layer<RpcSerialization>;
export {};
//# sourceMappingURL=RpcSerialization.d.ts.map