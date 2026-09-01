/**
 * Marks encoded worker message fields that should move through `postMessage` as
 * transfer-list entries.
 *
 * Worker messages still pass through schema encoding and structured clone, but
 * schemas wrapped with `schema` can also report backing resources such as
 * `ArrayBuffer`, `ImageData.data.buffer`, or `MessagePort` to a `Collector`.
 * Worker platforms then pass the collected values as the transfer list for the
 * same `postMessage` call, avoiding copies for large payloads and ports.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import { dual } from "../../Function.js";
import * as Schema from "../../Schema.js";
import * as SchemaGetter from "../../SchemaGetter.js";
/**
 * Service for collecting `Transferable` objects while encoding worker messages
 * so they can be passed to `postMessage` transfer lists.
 *
 * @category models
 * @since 4.0.0
 */
export class Collector extends /*#__PURE__*/Context.Service()("effect/workers/Transferable/Collector") {}
/**
 * Creates a mutable `Collector` service directly, exposing unsafe synchronous
 * methods for reading, adding, and clearing collected transferables.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeCollectorUnsafe = () => {
  let tranferables = [];
  const unsafeAddAll = transfers => {
    tranferables.push(...transfers);
  };
  const unsafeRead = () => tranferables;
  const unsafeClear = () => {
    const prev = tranferables;
    tranferables = [];
    return prev;
  };
  return Collector.of({
    addAllUnsafe: unsafeAddAll,
    addAll: transferables => Effect.sync(() => unsafeAddAll(transferables)),
    readUnsafe: unsafeRead,
    read: Effect.sync(unsafeRead),
    clearUnsafe: unsafeClear,
    clear: Effect.sync(unsafeClear)
  });
};
/**
 * Effect that creates a fresh `Collector` service for accumulating
 * transferables.
 *
 * @category constructors
 * @since 4.0.0
 */
export const makeCollector = /*#__PURE__*/Effect.sync(makeCollectorUnsafe);
/**
 * Adds transferables to the current `Collector` when one is present in the
 * context, and does nothing otherwise.
 *
 * @category accessors
 * @since 4.0.0
 */
export const addAll = tranferables => Effect.contextWith(services => {
  const collector = Context.getOrUndefined(services, Collector);
  if (!collector) return Effect.void;
  collector.addAllUnsafe(tranferables);
  return Effect.void;
});
/**
 * Creates a schema getter that records transferables derived from a value in
 * the current `Collector` while passing the value through unchanged.
 *
 * @category getters
 * @since 4.0.0
 */
export const getterAddAll = f => SchemaGetter.transformOrFail(e => Effect.contextWith(services => {
  const collector = Context.getOrUndefined(services, Collector);
  if (!collector) return Effect.succeed(e);
  collector.addAllUnsafe(f(e));
  return Effect.succeed(e);
}));
/**
 * Wraps a schema so encoding records transferables selected from the encoded
 * value, enabling worker messages to populate a `postMessage` transfer list.
 *
 * @category schemas
 * @since 4.0.0
 */
export const schema = /*#__PURE__*/dual(2, (self, f) => self.annotate({
  toCodecJson: () => passthroughLink
}).pipe(Schema.decode({
  decode: SchemaGetter.passthrough(),
  encode: getterAddAll(f)
})));
const passthroughLink = /*#__PURE__*/Schema.link()(Schema.Any, {
  decode: /*#__PURE__*/SchemaGetter.passthrough(),
  encode: /*#__PURE__*/SchemaGetter.passthrough()
});
/**
 * Schema for transferring `ImageData` values with their pixel data buffer.
 *
 * @category schemas
 * @since 4.0.0
 */
export const ImageData = /*#__PURE__*/schema(Schema.Any, _ => [_.data.buffer]);
/**
 * Schema for transferring `MessagePort` values as transferable objects.
 *
 * @category schemas
 * @since 4.0.0
 */
export const MessagePort = /*#__PURE__*/schema(Schema.Any, _ => [_]);
/**
 * Schema for transferring `Uint8Array` values with their backing buffer.
 *
 * @category schemas
 * @since 4.0.0
 */
export const Uint8Array = /*#__PURE__*/schema(Schema.Uint8Array, _ => [_.buffer]);
//# sourceMappingURL=Transferable.js.map