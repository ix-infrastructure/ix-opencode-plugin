/**
 * Stores refreshable scoped values.
 *
 * A `Resource<A, E>` keeps the latest successful or failed acquisition result.
 * It can be read repeatedly, refreshed manually, or refreshed automatically on a
 * schedule. Resource acquisition runs in a scope, so replacements and final
 * cleanup release the resources owned by previous values.
 *
 * @since 2.0.0
 */
import * as Context from "./Context.js";
import * as Effect from "./Effect.js";
import * as Exit from "./Exit.js";
import { identity } from "./Function.js";
import { PipeInspectableProto } from "./internal/core.js";
import { hasProperty } from "./Predicate.js";
import * as ScopedRef from "./ScopedRef.js";
const TypeId = "~effect/Resource";
/**
 * Returns `true` if the specified value is a `Resource`.
 *
 * **When to use**
 *
 * Use to validate unknown values at runtime boundaries before treating them as
 * `Resource` values.
 *
 * **Details**
 *
 * This predicate narrows the input to `Resource<unknown, unknown>`.
 *
 * @category guards
 * @since 4.0.0
 */
export const isResource = u => hasProperty(u, TypeId);
const Proto = {
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toJSON() {
    return {
      _id: "Resource"
    };
  }
};
const makeUnsafe = (scopedRef, acquire) => {
  const self = Object.create(Proto);
  self.scopedRef = scopedRef;
  self.acquire = acquire;
  return self;
};
/**
 * Creates a `Resource` that must be refreshed manually.
 *
 * **When to use**
 *
 * Use when you need manual control over resource refresh timing rather than an
 * automatic schedule.
 *
 * @see {@link auto} for schedule-driven automatic refreshes
 * @see {@link refresh} to manually trigger a resource refresh
 * @category constructors
 * @since 2.0.0
 */
export const manual = acquire => Effect.contextWith(context => {
  const providedAcquire = Effect.updateContext(acquire, input => Context.merge(context, input));
  return Effect.map(ScopedRef.fromAcquire(Effect.exit(providedAcquire)), scopedRef => makeUnsafe(scopedRef, providedAcquire));
});
/**
 * Creates a `Resource` that refreshes automatically according to the supplied
 * schedule.
 *
 * **When to use**
 *
 * Use when a resource should refresh in the background according to a schedule
 * for the lifetime of its scope.
 *
 * @see {@link manual} for caller-controlled refresh timing
 * @see {@link refresh} to trigger a refresh explicitly
 *
 * @category constructors
 * @since 2.0.0
 */
export const auto = (acquire, policy) => Effect.tap(manual(acquire), self => Effect.forkScoped(Effect.repeat(refresh(self), policy)));
/**
 * Retrieves the current value stored in this resource.
 *
 * **When to use**
 *
 * Use to read the value currently cached by a `Resource`.
 *
 * **Gotchas**
 *
 * If the resource currently stores a failed acquisition result, the returned
 * effect fails with the stored error.
 *
 * @see {@link refresh} to re-run acquisition and update the stored value before a later read
 *
 * @category getters
 * @since 2.0.0
 */
export const get = self => Effect.flatMap(ScopedRef.get(self.scopedRef), identity);
/**
 * Re-runs this resource's acquisition effect and updates the current value.
 *
 * **When to use**
 *
 * Use to force an existing `Resource` to reacquire its value at a
 * caller-controlled point.
 *
 * **Details**
 *
 * When acquisition succeeds, refreshing replaces the value stored in the
 * resource's scoped reference and releases resources associated with the
 * previous value.
 *
 * **Gotchas**
 *
 * If acquisition fails, the returned effect fails and the previously stored
 * result is left as what `get` reads.
 *
 * @see {@link get} for reading the current stored value
 * @see {@link manual} for resources refreshed only by caller action
 * @see {@link auto} for schedule-driven automatic refreshes
 *
 * @category resource management
 * @since 2.0.0
 */
export const refresh = self => ScopedRef.set(self.scopedRef, Effect.map(self.acquire, Exit.succeed));
//# sourceMappingURL=Resource.js.map