/**
 * Typed event definitions for the unstable event-log system.
 *
 * An `Event` is the durable contract shared by writers, handlers, journals, and
 * replicas. It gives an event a stable tag, derives the aggregate or entity
 * primary key from the decoded payload, and records the schemas used for the
 * payload, handler result, and handler errors. The payload schema is also used
 * to derive the MessagePack encoding for journal entries and remote
 * replication.
 *
 * @since 4.0.0
 */
import { pipeArguments } from "../../Pipeable.js";
import * as Predicate from "../../Predicate.js";
import * as Schema from "../../Schema.js";
import * as Msgpack from "../encoding/Msgpack.js";
/**
 * Runtime type identifier used to mark event log event definitions.
 *
 * @category type IDs
 * @since 4.0.0
 */
export const TypeId = "~effect/eventlog/Event";
/**
 * Returns `true` when a value is an event log event definition.
 *
 * @category guards
 * @since 4.0.0
 */
export const isEvent = u => Predicate.hasProperty(u, TypeId);
const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
export function make(options) {
  const payload = options.payload ?? Schema.Void;
  const success = options.success ?? Schema.Void;
  const error = options.error ?? Schema.Never;
  return Object.assign(Object.create(Proto), {
    tag: options.tag,
    primaryKey: options.primaryKey,
    payload,
    payloadMsgPack: Msgpack.schema(payload),
    success,
    error
  });
}
export function addError(event, error) {
  return make({
    tag: event.tag,
    primaryKey: event.primaryKey,
    payload: event.payload,
    success: event.success,
    error: Schema.Union([event.error, error])
  });
}
//# sourceMappingURL=Event.js.map