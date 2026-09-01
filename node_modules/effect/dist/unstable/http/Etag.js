/**
 * HTTP entity tag values and metadata-based generator layers.
 *
 * ETags are validators for a specific representation of a resource. Servers put
 * them in `ETag` response headers so clients and intermediaries can revalidate
 * cached content with `If-None-Match`, or protect writes with preconditions such
 * as `If-Match`.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Layer from "../../Layer.js";
import * as Option from "../../Option.js";
/**
 * Formats an `Etag` as an HTTP header value, including quotes and the `W/` prefix for weak tags.
 *
 * @category converting
 * @since 4.0.0
 */
export const toString = self => {
  switch (self._tag) {
    case "Weak":
      return `W/"${self.value}"`;
    case "Strong":
      return `"${self.value}"`;
  }
};
/**
 * Service for generating ETags from filesystem file information or Web `File`-like metadata.
 *
 * @category models
 * @since 4.0.0
 */
export class Generator extends /*#__PURE__*/Context.Service()("effect/http/Etag/Generator") {}
const fromFileInfo = info => {
  const mtime = Option.match(info.mtime, {
    onNone: () => "0",
    onSome: mtime => mtime.getTime().toString(16)
  });
  return `${info.size.toString(16)}-${mtime}`;
};
const fromFileWeb = file => {
  return `${file.size.toString(16)}-${file.lastModified.toString(16)}`;
};
/**
 * Layer that provides a `Generator` which produces strong ETags from file size
 * and modification time metadata.
 *
 * **When to use**
 *
 * Use when you need the `Generator` service to produce strong ETags and file
 * size plus modification time reliably change for every byte-level change.
 *
 * **Gotchas**
 *
 * This layer marks metadata-derived tags as strong. If the underlying storage
 * can update file contents without changing the recorded size or modification
 * time, those tags can stop representing byte-for-byte identity.
 *
 * @see {@link layerWeak} for weak metadata-derived ETags when byte-for-byte identity is not required
 * @see {@link Generator} for the service provided by this layer
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = /*#__PURE__*/Layer.succeed(Generator)({
  fromFileInfo(info) {
    return Effect.sync(() => ({
      _tag: "Strong",
      value: fromFileInfo(info)
    }));
  },
  fromFileWeb(file) {
    return Effect.sync(() => ({
      _tag: "Strong",
      value: fromFileWeb(file)
    }));
  }
});
/**
 * Layer that provides a `Generator` which produces weak ETags from file size and modification time metadata.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerWeak = /*#__PURE__*/Layer.succeed(Generator)({
  fromFileInfo(info) {
    return Effect.sync(() => ({
      _tag: "Weak",
      value: fromFileInfo(info)
    }));
  },
  fromFileWeb(file) {
    return Effect.sync(() => ({
      _tag: "Weak",
      value: fromFileWeb(file)
    }));
  }
});
//# sourceMappingURL=Etag.js.map