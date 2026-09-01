/**
 * Defines typed durable workflows.
 *
 * A `Workflow` has a stable tag, schemas for payload, success, and failure, and
 * an idempotency key used to derive execution ids. Workflow definitions can be
 * executed, discarded, polled, interrupted, resumed, and registered with a
 * handler layer. This module also includes workflow result types, compensation
 * and cleanup helpers, suspension support, and settings for defect capture or
 * failure suspension.
 *
 * @since 4.0.0
 */
import * as Arr from "../../Array.js";
import * as Cause from "../../Cause.js";
import * as Context from "../../Context.js";
import * as Data from "../../Data.js";
import * as Effect from "../../Effect.js";
import * as Exit from "../../Exit.js";
import * as Fiber from "../../Fiber.js";
import * as Filter from "../../Filter.js";
import { constFalse, constTrue, dual, identity } from "../../Function.js";
import * as Layer from "../../Layer.js";
import * as Option from "../../Option.js";
import * as Predicate from "../../Predicate.js";
import * as Schema from "../../Schema.js";
import * as SchemaIssue from "../../SchemaIssue.js";
import * as SchemaParser from "../../SchemaParser.js";
import * as Tranformation from "../../SchemaTransformation.js";
import * as Scope from "../../Scope.js";
import { makeHashDigest } from "./internal/crypto.js";
const TypeId = "~effect/workflow/Workflow";
const EngineTag = /*#__PURE__*/Context.Service("effect/workflow/WorkflowEngine");
const InstanceTag = /*#__PURE__*/Context.Service("effect/workflow/WorkflowEngine/WorkflowInstance");
const makeExecutionIdFromPayload = (self, payload) => makeHashDigest(`${self._tag}-${self.idempotencyKey(payload)}`);
const Proto = {
  [TypeId]: TypeId,
  annotate(tag, value) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      annotations: Context.add(this.annotations, tag, value),
      idempotencyKey: this.idempotencyKey,
      suspendedRetrySchedule: this.suspendedRetrySchedule
    });
  },
  annotateMerge(context) {
    return makeProto({
      _tag: this._tag,
      payloadSchema: this.payloadSchema,
      successSchema: this.successSchema,
      errorSchema: this.errorSchema,
      annotations: Context.merge(this.annotations, context),
      idempotencyKey: this.idempotencyKey,
      suspendedRetrySchedule: this.suspendedRetrySchedule
    });
  },
  execute(fields, opts) {
    return Effect.suspend(() => {
      const payload = this.payloadSchema.make(fields);
      return Effect.flatMap(EngineTag, engine => Effect.flatMap(makeExecutionIdFromPayload(this, payload), executionId => Effect.andThen(Effect.annotateCurrentSpan({
        executionId
      }), engine.execute(this, {
        executionId,
        payload,
        discard: opts?.discard,
        suspendedRetrySchedule: this.suspendedRetrySchedule
      }))));
    }).pipe(Effect.withSpan(`${this._tag}.execute`, {}, {
      captureStackTrace: false
    }));
  },
  poll(executionId) {
    return Effect.flatMap(EngineTag, engine => engine.poll(this, executionId)).pipe(Effect.withSpan(`${this._tag}.poll`, {
      attributes: {
        executionId
      }
    }, {
      captureStackTrace: false
    }));
  },
  interrupt(executionId) {
    return Effect.flatMap(EngineTag, engine => engine.interrupt(this, executionId)).pipe(Effect.withSpan(`${this._tag}.interrupt`, {
      attributes: {
        executionId
      }
    }, {
      captureStackTrace: false
    }));
  },
  resume(executionId) {
    return Effect.flatMap(EngineTag, engine => engine.resume(this, executionId)).pipe(Effect.withSpan(`${this._tag}.resume`, {
      attributes: {
        executionId
      }
    }, {
      captureStackTrace: false
    }));
  },
  toLayer(execute) {
    return Layer.effectDiscard(Effect.flatMap(EngineTag, engine => engine.register(this, execute)));
  },
  executionId(payload) {
    return Effect.flatMap(Effect.orDie(this.payloadSchema.makeEffect(payload)), payload => makeExecutionIdFromPayload(this, payload));
  },
  withCompensation: (...args) => withCompensation(...args)
};
const makeProto = options => {
  function Workflow() {}
  Object.setPrototypeOf(Workflow, Proto);
  Object.assign(Workflow, options);
  return Workflow;
};
/**
 * Creates a durable workflow definition with schemas, annotations, and
 * deterministic execution IDs derived from the workflow tag and idempotency
 * key.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = (tag, options) => makeProto({
  _tag: tag,
  payloadSchema: Schema.isSchema(options.payload) ? options.payload : Schema.Struct(options.payload),
  successSchema: options.success ?? Schema.Void,
  errorSchema: options.error ?? Schema.Never,
  annotations: options.annotations ?? Context.empty(),
  idempotencyKey: options.idempotencyKey,
  suspendedRetrySchedule: options.suspendedRetrySchedule
});
const ResultTypeId = "~effect/workflow/Workflow/Result";
/**
 * Returns `true` when a value is a workflow `Result`.
 *
 * @category results
 * @since 4.0.0
 */
export const isResult = u => Predicate.hasProperty(u, ResultTypeId);
/**
 * Represents a completed workflow execution with its success or failure `Exit`.
 *
 * @category results
 * @since 4.0.0
 */
export class Complete extends /*#__PURE__*/Data.TaggedClass("Complete") {
  /**
   * Marks this value as a workflow result for runtime guards.
   *
   * @since 4.0.0
   */
  [ResultTypeId] = ResultTypeId;
  /**
   * Builds the schema for completed workflow results from success and error schemas.
   *
   * @since 4.0.0
   */
  static Schema(options) {
    // TODO: extract to a helper function
    const schema = Schema.declareConstructor()([Schema.Exit(options.success, options.error, Schema.Defect())], ([exit]) => (input, ast, options) => {
      if (!(isResult(input) && input._tag === "Complete")) {
        return Effect.fail(new SchemaIssue.InvalidType(ast, Option.some(input)));
      }
      return Effect.mapBothEager(SchemaParser.decodeEffect(exit)(input.exit, options), {
        onSuccess: exit => new Complete({
          exit
        }),
        onFailure: issue => new SchemaIssue.Composite(ast, Option.some(input), [new SchemaIssue.Pointer(["exit"], issue)])
      });
    }, {
      expected: "Workflow.Complete",
      toCodecJson: ([exit]) => Schema.link()(Schema.Struct({
        _tag: Schema.tag("Complete"),
        exit
      }), Tranformation.transform({
        decode: encoded => new Complete({
          exit: encoded.exit
        }),
        encode: result => ({
          _tag: "Complete",
          exit: result.exit
        })
      }))
    });
    return Schema.make(schema.ast, {
      success: options.success,
      error: options.error
    });
  }
}
/**
 * Represents a suspended workflow execution, optionally carrying the cause that
 * triggered suspension.
 *
 * @category results
 * @since 4.0.0
 */
export class Suspended extends /*#__PURE__*/Schema.Class("effect/workflow/Workflow/Suspended")({
  _tag: /*#__PURE__*/Schema.tag("Suspended"),
  cause: /*#__PURE__*/Schema.optional(/*#__PURE__*/Schema.Cause(Schema.Never, /*#__PURE__*/Schema.Defect()))
}) {
  /**
   * Marks this value as a workflow result for runtime guards.
   *
   * @since 4.0.0
   */
  [ResultTypeId] = ResultTypeId;
}
/**
 * Creates a schema for workflow results using the supplied success and error
 * schemas.
 *
 * @category results
 * @since 4.0.0
 */
export const Result = options => Schema.Union([Complete.Schema(options), Suspended]);
const AnyOrVoid = /*#__PURE__*/Schema.Union([Schema.Any, Schema.Void]);
/**
 * Schema for encoded workflow results with generic success and error payloads.
 *
 * @category results
 * @since 4.0.0
 */
export const ResultEncoded = /*#__PURE__*/Schema.toEncoded(/*#__PURE__*/Schema.toCodecJson(/*#__PURE__*/Result({
  success: AnyOrVoid,
  error: AnyOrVoid
})));
/**
 * Runs an effect as a workflow execution and converts its outcome into a
 * `Result`, handling suspension, defect capture, interruption, and workflow
 * scope finalization.
 *
 * @category results
 * @since 4.0.0
 */
export const intoResult = effect => Effect.contextWith(context => {
  const instance = Context.get(context, InstanceTag);
  const captureDefects = Context.get(instance.workflow.annotations, CaptureDefects);
  const suspendOnFailure = Context.get(instance.workflow.annotations, SuspendOnFailure);
  return effect.pipe(
  // so we can use external interruption to suspend the workflow
  Effect.forkChild({
    startImmediately: true
  }), Effect.flatMap(fiber => Effect.onInterrupt(Fiber.join(fiber), () => Fiber.interrupt(fiber))), Effect.interruptible, suspendOnFailure ? Effect.catchCause(cause => {
    instance.suspended = true;
    if (!Cause.hasInterruptsOnly(cause)) {
      instance.cause = Cause.die(Cause.squash(cause));
    }
    return Effect.interrupt;
  }) : identity, Effect.scoped, Effect.matchCauseEffect({
    onSuccess: value => Effect.succeed(new Complete({
      exit: Exit.succeed(value)
    })),
    onFailure: cause => {
      const [reasons, interrupts] = Arr.partition(cause.reasons, Filter.fromPredicate(Cause.isInterruptReason));
      const hasInterruptsOnly = interrupts.length === cause.reasons.length;
      const filtered = reasons.length === 0 ? cause : Cause.fromReasons(reasons);
      return instance.suspended && hasInterruptsOnly ? Effect.succeed(new Suspended({
        cause: instance.cause
      })) : !instance.interrupted && hasInterruptsOnly || !captureDefects && Cause.hasDies(cause) ? Effect.failCause(filtered) : Effect.succeed(new Complete({
        exit: Exit.failCause(filtered)
      }));
    }
  }), eff => Effect.onExitPrimitive(eff, exit => {
    if (Exit.isFailure(exit)) {
      return Scope.close(instance.scope, exit);
    } else if (exit.value._tag === "Complete") {
      return Scope.close(instance.scope, exit.value.exit);
    }
    return Effect.void;
  }, true), Effect.uninterruptible);
});
/**
 * Wraps an activity-like effect so workflow suspension waits for currently
 * running activities to finish or suspend.
 *
 * @category results
 * @since 4.0.0
 */
export const wrapActivityResult = (effect, isSuspend) => Effect.contextWith(context => {
  const instance = Context.get(context, InstanceTag);
  const state = instance.activityState;
  if (state.count === 0) state.latch.closeUnsafe();
  state.count++;
  return Effect.onExit(effect, exit => {
    state.count--;
    const isSuspended = Exit.isSuccess(exit) && isSuspend(exit.value);
    if (Exit.isSuccess(exit) && isResult(exit.value) && exit.value._tag === "Suspended" && exit.value.cause) {
      instance.cause = instance.cause ? Cause.combine(instance.cause, exit.value.cause) : exit.value.cause;
    }
    return state.count === 0 ? state.latch.open : isSuspended ? waitForZero(instance) : Effect.void;
  });
});
const waitForZero = /*#__PURE__*/Effect.fnUntraced(function* (instance) {
  const state = instance.activityState;
  while (true) {
    if (state.count > 0) {
      yield* state.latch.await;
      yield* Effect.yieldNow;
      continue;
    }
    yield* Effect.yieldNow;
    if (state.count === 0) return;
  }
});
/**
 * Accesses the workflow scope, which is only closed when the workflow execution fully completes.
 *
 * @category resource management
 * @since 4.0.0
 */
export const scope = /*#__PURE__*/Effect.map(InstanceTag, instance => instance.scope);
/**
 * Provides the workflow scope to the given effect, and closes the scope only when the workflow execution fully completes.
 *
 * @category resource management
 * @since 4.0.0
 */
export const provideScope = effect => Effect.flatMap(scope, scope => Scope.provide(effect, scope));
/**
 * Adds an exit finalizer to the current workflow scope, preserving the
 * services available when the finalizer is registered.
 *
 * @category resource management
 * @since 4.0.0
 */
export const addFinalizer = /*#__PURE__*/Effect.fnUntraced(function* (f) {
  const scope = (yield* InstanceTag).scope;
  const services = yield* Effect.context();
  yield* Scope.addFinalizerExit(scope, exit => Effect.provideContext(f(exit), services));
});
/**
 * Adds compensation logic to an effect inside a Workflow.
 *
 * **When to use**
 *
 * Use when a top-level workflow step needs compensating cleanup if the overall
 * workflow later fails after the step succeeds.
 *
 * **Details**
 *
 * The compensation finalizer is called if the entire workflow fails, allowing you to perform cleanup or other actions based on the success value and the cause of the workflow failure.
 *
 * **Gotchas**
 *
 * Compensation finalizers are only registered for top-level effects in the workflow and do not work for nested activities.
 *
 * @category Compensation
 * @since 4.0.0
 */
export const withCompensation = /*#__PURE__*/dual(2, (effect, compensation) => Effect.uninterruptibleMask(restore => Effect.tap(restore(effect), value => addFinalizer(exit => Exit.isSuccess(exit) ? Effect.void : compensation(value, exit.cause)))));
/**
 * Marks a workflow instance as suspended and interrupts the current fiber to
 * stop execution until it is resumed.
 *
 * @category results
 * @since 4.0.0
 */
export const suspend = instance => Effect.interruptible(Effect.callback(() => {
  instance.suspended = true;
  const fiber = Fiber.getCurrent();
  fiber.interruptUnsafe(fiber.id);
}));
/**
 * Captures defects for a workflow and includes them in the result of the workflow or its activities.
 *
 * **Details**
 *
 * By default, this annotation is set to `true`, meaning defects are captured.
 *
 * @category annotations
 * @since 4.0.0
 */
export const CaptureDefects = /*#__PURE__*/Context.Reference("effect/workflow/Workflow/CaptureDefects", {
  defaultValue: constTrue
});
/**
 * Marks a workflow to suspend when it encounters any error.
 *
 * **Details**
 *
 * The suspended execution can later be resumed with the workflow's `resume` method, for example `MyWorkflow.resume(executionId)`.
 *
 * @category annotations
 * @since 4.0.0
 */
export const SuspendOnFailure = /*#__PURE__*/Context.Reference("effect/workflow/Workflow/SuspendOnFailure", {
  defaultValue: constFalse
});
//# sourceMappingURL=Workflow.js.map