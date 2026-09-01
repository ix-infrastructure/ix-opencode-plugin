/**
 * Defines groups of typed events for the unstable event-log system.
 *
 * An `EventGroup` collects event definitions that belong together. Start with
 * `empty`, add events with their payload, success, and error schemas, then use
 * the group to build clients with `EventLog.schema` and server handlers with
 * `EventLog.group`. The group only describes events; it does not write or run
 * them.
 *
 * @since 4.0.0
 */
import { pipeArguments } from "../../Pipeable.js";
import * as Predicate from "../../Predicate.js";
import * as Record from "../../Record.js";
import * as Event from "./Event.js";
/**
 * Runtime type identifier used to mark event log event groups.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/eventlog/EventGroup";
/**
 * Returns `true` when a value is an event log event group.
 *
 * @category guards
 * @since 4.0.0
 */
export const isEventGroup = u => Predicate.hasProperty(u, TypeId);
const makeProto = options => {
  const EventGroupClass = _ => {};
  const group = Object.assign(EventGroupClass, {
    [TypeId]: TypeId,
    events: options.events,
    add(addOptions) {
      return makeProto({
        events: {
          ...this.events,
          [addOptions.tag]: Event.make(addOptions)
        }
      });
    },
    addError(error) {
      const events = Record.map(this.events, event => Event.addError(event, error));
      return makeProto({
        events
      });
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  });
  return group;
};
/**
 * Creates an empty event group used as the starting point for defining a group.
 *
 * **When to use**
 *
 * Use when you need the starting `EventGroup` value before adding event
 * definitions with `.add(...)`.
 *
 * @category constructors
 * @since 4.0.0
 */
export const empty = /*#__PURE__*/makeProto({
  events: /*#__PURE__*/Record.empty()
});
//# sourceMappingURL=EventGroup.js.map