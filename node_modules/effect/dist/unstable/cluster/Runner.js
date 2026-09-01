/**
 * Cluster runner metadata for processes that can host entity shards.
 *
 * A `Runner` combines the stable `RunnerAddress` used to contact a process, the
 * shard groups that process participates in, and the relative weight used when
 * the sharding service distributes shards across healthy runners.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.js";
import * as Hash from "../../Hash.js";
import { NodeInspectSymbol } from "../../Inspectable.js";
import * as Schema from "../../Schema.js";
import { RunnerAddress } from "./RunnerAddress.js";
const TypeId = "~effect/cluster/Runner";
/**
 * Represents a cluster runner that can host entities.
 *
 * **Details**
 *
 * Each runner has a unique network `address`, the shard `groups` it participates
 * in, and a relative `weight` used when assigning shards across runners.
 *
 * @category models
 * @since 4.0.0
 */
export class Runner extends /*#__PURE__*/Schema.Class(TypeId)({
  address: RunnerAddress,
  groups: /*#__PURE__*/Schema.Array(Schema.String),
  weight: Schema.Number
}) {
  /**
   * Formatter for rendering runner values consistently.
   *
   * @since 4.0.0
   */
  static format = /*#__PURE__*/Schema.toFormatter(this);
  /**
   * Marks this value as a cluster runner for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  /**
   * Decodes a runner from its JSON string representation.
   *
   * @since 4.0.0
   */
  static decodeSync = /*#__PURE__*/Schema.decodeSync(/*#__PURE__*/Schema.fromJsonString(Runner));
  /**
   * Encodes a runner to its JSON string representation.
   *
   * @since 4.0.0
   */
  static encodeSync = /*#__PURE__*/Schema.encodeSync(/*#__PURE__*/Schema.fromJsonString(Runner));
  /**
   * Formats this runner as a string.
   *
   * @since 4.0.0
   */
  toString() {
    return Runner.format(this);
  }
  /**
   * Formats this runner for Node.js inspection.
   *
   * @since 4.0.0
   */
  [NodeInspectSymbol]() {
    return this.toString();
  }
  /**
   * Compares runners by address and shard-assignment weight.
   *
   * @since 4.0.0
   */
  [Equal.symbol](that) {
    return this.address[Equal.symbol](that.address) && this.weight === that.weight;
  }
  /**
   * Computes a structural hash from the runner address and shard-assignment weight.
   *
   * @since 4.0.0
   */
  [Hash.symbol]() {
    return Hash.string(`${this.address.toString()}:${this.weight}`);
  }
}
/**
 * Constructs a `Runner` from its network address, shard groups, and relative
 * shard-assignment weight.
 *
 * **When to use**
 *
 * Use to build runner metadata from an existing `RunnerAddress`, shard groups,
 * and relative weight when registering or exchanging a cluster runner.
 *
 * **Details**
 *
 * The `groups` array lists the shard groups the runner can host. During shard
 * assignment, the runner's address is added to each group's hash ring with
 * `weight` as its relative weight.
 *
 * **Gotchas**
 *
 * This helper constructs the value without runtime schema validation, so only
 * pass trusted `RunnerAddress`, `groups`, and `weight` values.
 *
 * @see {@link Runner} for the value created by this helper
 * @see {@link RunnerAddress} for the network address accepted in `props.address`
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = props => new Runner(props, {
  disableChecks: true
});
//# sourceMappingURL=Runner.js.map