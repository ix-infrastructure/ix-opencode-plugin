/**
 * The `EntityId` module defines the branded string used to identify one entity
 * instance within an entity type. The value is the routing key that sharding
 * hashes, stores in entity addresses, and uses when sending messages to a
 * running entity.
 *
 * @since 4.0.0
 */
import * as Schema from "../../Schema.js";
/**
 * Schema for branded string entity identifiers used inside the cluster.
 *
 * @category constructors
 * @since 4.0.0
 */
export const EntityId = /*#__PURE__*/Schema.String.pipe(/*#__PURE__*/Schema.brand("~effect/cluster/EntityId"));
/**
 * Brands a string as an `EntityId`.
 *
 * **When to use**
 *
 * Use to turn a trusted, stable entity routing key into an `EntityId` before
 * passing it to cluster APIs.
 *
 * **Details**
 *
 * The branded value is the original string at runtime.
 *
 * **Gotchas**
 *
 * `make` does not validate, normalize, or make the value unique. Choose
 * deterministic strings because cluster routing hashes the exact entity id
 * value.
 *
 * @see {@link EntityId} for the schema that validates and encodes branded entity identifiers
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = id => id;
//# sourceMappingURL=EntityId.js.map