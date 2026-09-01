/**
 * Typed error model for worker APIs.
 *
 * This module defines the `WorkerError` wrapper, the reason variants for spawn,
 * send, receive, and unknown worker failures, a schema union for those reasons,
 * and a guard for recognizing worker errors at runtime.
 *
 * @since 4.0.0
 */
import { hasProperty } from "../../Predicate.js";
import * as Schema from "../../Schema.js";
const TypeId = "~effect/workers/WorkerError";
/**
 * Returns `true` when a value is a `WorkerError`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isWorkerError = u => hasProperty(u, TypeId);
/**
 * Worker error reason for failures while spawning or setting up a worker.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerSpawnError extends /*#__PURE__*/Schema.ErrorClass("effect/workers/WorkerError/WorkerSpawnError")({
  _tag: /*#__PURE__*/Schema.tag("WorkerSpawnError"),
  message: Schema.String,
  cause: /*#__PURE__*/Schema.optional(/*#__PURE__*/Schema.Defect())
}) {}
/**
 * Worker error reason for failures while sending a message to a worker.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerSendError extends /*#__PURE__*/Schema.ErrorClass("effect/workers/WorkerError/WorkerSendError")({
  _tag: /*#__PURE__*/Schema.tag("WorkerSendError"),
  message: Schema.String,
  cause: /*#__PURE__*/Schema.optional(/*#__PURE__*/Schema.Defect())
}) {}
/**
 * Worker error reason for failures while receiving or handling a message from a
 * worker.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerReceiveError extends /*#__PURE__*/Schema.ErrorClass("effect/workers/WorkerError/WorkerReceiveError")({
  _tag: /*#__PURE__*/Schema.tag("WorkerReceiveError"),
  message: Schema.String,
  cause: /*#__PURE__*/Schema.optional(/*#__PURE__*/Schema.Defect())
}) {}
/**
 * Worker error reason for an unclassified worker failure.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerUnknownError extends /*#__PURE__*/Schema.ErrorClass("effect/workers/WorkerError/WorkerUnknownError")({
  _tag: /*#__PURE__*/Schema.tag("WorkerUnknownError"),
  message: Schema.String,
  cause: /*#__PURE__*/Schema.optional(/*#__PURE__*/Schema.Defect())
}) {}
/**
 * Schema for decoding and encoding all supported worker error reason variants.
 *
 * @category models
 * @since 4.0.0
 */
export const WorkerErrorReason = /*#__PURE__*/Schema.Union([WorkerSpawnError, WorkerSendError, WorkerReceiveError, WorkerUnknownError]);
/**
 * Error raised by worker APIs, wrapping a specific `WorkerErrorReason` and
 * exposing its message and cause.
 *
 * @category models
 * @since 4.0.0
 */
export class WorkerError extends /*#__PURE__*/Schema.ErrorClass(TypeId)({
  _tag: /*#__PURE__*/Schema.tag("WorkerError"),
  reason: WorkerErrorReason
}) {
  // @effect-diagnostics-next-line overriddenSchemaConstructor:off
  constructor(props) {
    super({
      ...props,
      cause: props.reason.cause
    });
  }
  /**
   * Marks this value as a worker error for runtime guards.
   *
   * @since 4.0.0
   */
  [TypeId] = TypeId;
  get message() {
    return this.reason.message;
  }
}
//# sourceMappingURL=WorkerError.js.map