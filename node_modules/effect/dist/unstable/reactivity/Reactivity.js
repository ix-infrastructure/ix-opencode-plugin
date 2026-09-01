/**
 * Process-local invalidation for connecting writes to dependent reads.
 *
 * This module does not cache values itself. It lets callers register handlers
 * for keys, invalidate those keys, wrap successful mutations so they invalidate
 * keys, and expose effects as queues or streams that rerun when matching keys
 * change. The service can also batch invalidations so handlers run after the
 * batch completes.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Fiber from "../../Fiber.js";
import { dual, flow } from "../../Function.js";
import * as Hash from "../../Hash.js";
import * as Layer from "../../Layer.js";
import * as Queue from "../../Queue.js";
import * as Scope from "../../Scope.js";
import * as Stream from "../../Stream.js";
/**
 * Service for key-based reactive invalidation.
 *
 * **When to use**
 *
 * Use to provide the invalidation service that refreshes queries, streams, and
 * atoms when application keys change.
 *
 * **Details**
 *
 * The service can register handlers for keys, invalidate those keys, wrap
 * mutations so successful effects invalidate keys, and turn query effects into
 * queues or streams that rerun when keys are invalidated.
 *
 * @category services
 * @since 4.0.0
 */
export class Reactivity extends /*#__PURE__*/Context.Service()("effect/reactivity/Reactivity") {}
/**
 * Creates an in-memory `Reactivity` service.
 *
 * **Details**
 *
 * The service tracks handlers by hashed keys and runs the registered handlers when
 * matching keys are invalidated.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = /*#__PURE__*/Effect.sync(() => {
  const handlers = new Map();
  const invalidateUnsafe = keys => {
    keysToHashes(keys, hash => {
      const set = handlers.get(hash);
      if (set === undefined) return;
      set.forEach(run => run());
    });
  };
  const invalidate = keys => Effect.contextWith(services => {
    const pending = services.mapUnsafe.get(PendingInvalidation.key);
    if (pending) {
      keysToHashes(keys, hash => {
        pending.add(hash);
      });
    } else {
      invalidateUnsafe(keys);
    }
    return Effect.void;
  });
  const mutation = (keys, effect) => Effect.tap(effect, invalidate(keys));
  const registerUnsafe = (keys, handler) => {
    const resolvedKeys = [];
    keysToHashes(keys, hash => {
      resolvedKeys.push(hash);
      let set = handlers.get(hash);
      if (set === undefined) {
        set = new Set();
        handlers.set(hash, set);
      }
      set.add(handler);
    });
    return () => {
      for (let i = 0; i < resolvedKeys.length; i++) {
        const set = handlers.get(resolvedKeys[i]);
        set.delete(handler);
        if (set.size === 0) {
          handlers.delete(resolvedKeys[i]);
        }
      }
    };
  };
  const query = (keys, effect) => Effect.gen(function* () {
    const services = yield* Effect.context();
    const scope = Context.get(services, Scope.Scope);
    const results = yield* Queue.make();
    const runFork = flow(Effect.runForkWith(services), Fiber.runIn(scope));
    let running = false;
    let pending = false;
    const handleExit = exit => {
      if (exit._tag === "Failure") {
        Queue.failCauseUnsafe(results, exit.cause);
      } else {
        Queue.offerUnsafe(results, exit.value);
      }
      if (pending) {
        pending = false;
        runFork(effect).addObserver(handleExit);
      } else {
        running = false;
      }
    };
    function run() {
      if (running) {
        pending = true;
        return;
      }
      running = true;
      runFork(effect).addObserver(handleExit);
    }
    const cancel = registerUnsafe(keys, run);
    yield* Scope.addFinalizer(scope, Effect.sync(cancel));
    run();
    return results;
  });
  const stream = (tables, effect) => query(tables, effect).pipe(Effect.map(Stream.fromQueue), Stream.unwrap);
  const withBatch = effect => Effect.suspend(() => {
    const pending = new Set();
    return effect.pipe(Effect.provideService(PendingInvalidation, pending), Effect.onExit(_ => Effect.sync(() => {
      pending.forEach(hash => {
        const set = handlers.get(hash);
        if (set === undefined) return;
        set.forEach(run => run());
      });
    })));
  });
  return Reactivity.of({
    mutation,
    query,
    stream,
    invalidateUnsafe,
    invalidate,
    registerUnsafe,
    withBatch
  });
});
class PendingInvalidation extends /*#__PURE__*/Context.Service()("effect/reactivity/Reactivity/PendingInvalidation") {}
/**
 * Wraps an effect so the supplied keys are invalidated after the effect succeeds.
 *
 * **Gotchas**
 *
 * If the effect fails, the keys are not invalidated.
 *
 * @category accessors
 * @since 4.0.0
 */
export const mutation = /*#__PURE__*/dual(2, (effect, keys) => Reactivity.use(_ => _.mutation(keys, effect)));
/**
 * Runs an effect as a query tied to the supplied invalidation keys.
 *
 * **Details**
 *
 * The returned queue receives the initial result and each later result after the
 * keys are invalidated. The registration is removed when the current scope closes.
 *
 * @category accessors
 * @since 4.0.0
 */
export const query = /*#__PURE__*/dual(2, (effect, keys) => Reactivity.use(r => r.query(keys, effect)));
/**
 * Runs an effect as a stream of query results tied to the supplied invalidation
 * keys.
 *
 * **Details**
 *
 * The effect runs initially and reruns whenever the keys are invalidated.
 *
 * @category accessors
 * @since 4.0.0
 */
export const stream = /*#__PURE__*/dual(2, (effect, keys) => Reactivity.use(r => r.query(keys, effect)).pipe(Effect.map(Stream.fromQueue), Stream.unwrap));
/**
 * Invalidates the supplied keys through the `Reactivity` service.
 *
 * **Details**
 *
 * Registered queries for matching keys are rerun immediately, or collected until
 * the enclosing reactivity batch completes.
 *
 * @category accessors
 * @since 4.0.0
 */
export const invalidate = keys => Reactivity.use(r => r.invalidate(keys));
/**
 * The default layer that provides an in-memory `Reactivity` service.
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = /*#__PURE__*/Layer.effect(Reactivity)(make);
function stringOrHash(u) {
  switch (typeof u) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
      return String(u);
    default:
      return Hash.hash(u);
  }
}
const keysToHashes = (keys, f) => {
  if (Array.isArray(keys)) {
    for (let i = 0; i < keys.length; i++) {
      f(stringOrHash(keys[i]));
    }
    return;
  }
  for (const key in keys) {
    f(key);
    const ids = keys[key];
    for (let i = 0; i < ids.length; i++) {
      f(`${key}:${stringOrHash(ids[i])}`);
    }
  }
};
//# sourceMappingURL=Reactivity.js.map