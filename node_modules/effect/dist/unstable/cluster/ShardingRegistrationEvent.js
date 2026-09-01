/**
 * The `ShardingRegistrationEvent` module models the live notifications emitted
 * by `Sharding` when the local runner registers an entity handler or singleton.
 * Consumers can use these events to wait for registrations during startup,
 * inspect which capabilities a runner made available, or assert registration
 * behavior in tests.
 *
 * @since 4.0.0
 */
import * as Data from "../../Data.js";
/**
 * Constructors and matchers for sharding registration events.
 *
 * @category pattern matching
 * @since 4.0.0
 */
export const {
  /**
   * Pattern matches on a sharding registration event and dispatches to the
   * matching variant handler.
   *
   * @category pattern matching
   * @since 4.0.0
   */
  $match: match,
  /**
   * Creates an event for an entity registered by the local runner.
   *
   * @category constructors
   * @since 4.0.0
   */
  EntityRegistered,
  /**
   * Creates an event for a singleton registered by the local runner.
   *
   * @category constructors
   * @since 4.0.0
   */
  SingletonRegistered
} = /*#__PURE__*/Data.taggedEnum();
//# sourceMappingURL=ShardingRegistrationEvent.js.map