/**
 * Network addresses for locating cluster runners. A `RunnerAddress` stores the
 * host and port for a runner and provides schema support, structural equality,
 * hashing, Node.js inspection, and a stable primary key formatted from the host
 * and port.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.js";
import * as Hash from "../../Hash.js";
import { NodeInspectSymbol } from "../../Inspectable.js";
import * as PrimaryKey from "../../PrimaryKey.js";
import * as Schema from "../../Schema.js";
const TypeId = "~effect/cluster/RunnerAddress";
/**
 * Represents the network address of a cluster runner, identified by host and
 * port.
 *
 * **When to use**
 *
 * Use to represent the host and port that identify a runner in cluster routing,
 * registration, and health checks.
 *
 * @category models
 * @since 4.0.0
 */
export class RunnerAddress extends /*#__PURE__*/Schema.Class(TypeId)({
  host: Schema.String,
  port: Schema.Number
}) {
  /**
   * Marks this value as a cluster runner address for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Compares runner addresses by host and port.
   *
   * @since 4.0.0
   */
  [Equal.symbol](that) {
    return this.host === that.host && this.port === that.port;
  }
  /**
   * Computes a structural hash from the host and port.
   *
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.string(`${this.host}:${this.port}`);
  }
  /**
   * Stable primary key used to identify the runner address.
   *
   * @since 4.0.0
   */
  [PrimaryKey.symbol]() {
    return `${this.host}:${this.port}`;
  }
  /**
   * Formats the runner address with its host and port.
   *
   * @since 4.0.0
   */
  toString() {
    return `RunnerAddress(${this.host}:${this.port})`;
  }
  /**
   * Formats the runner address for Node.js inspection.
   *
   * @since 4.0.0
   */
  [NodeInspectSymbol]() {
    return this.toString();
  }
}
/**
 * Constructs a `RunnerAddress` from a host and port.
 *
 * **When to use**
 *
 * Use to create the stable network identity for a cluster runner when
 * configuring sharding, registering runner metadata, or targeting a runner by
 * host and port.
 *
 * **Details**
 *
 * The returned `RunnerAddress` stores the supplied `host` and `port`. Equality,
 * hashing, and the primary key use both fields, with the primary key formatted
 * as `host:port`.
 *
 * **Gotchas**
 *
 * `make` does not normalize the host. Pass the host string exactly as the
 * cluster routing and storage layers should identify it.
 *
 * @see {@link RunnerAddress} for the constructed address type and its equality, hashing, primary-key, and formatting behavior
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (host, port) => new RunnerAddress({
  host,
  port
}, {
  disableChecks: true
});
//# sourceMappingURL=RunnerAddress.js.map