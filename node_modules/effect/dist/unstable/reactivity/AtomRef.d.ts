/**
 * Mutable reactive references for local, in-memory state.
 *
 * `AtomRef` provides small observable state cells that can be read, updated,
 * mapped, and subscribed to without going through an `AtomRegistry`. Mutable
 * refs can also create refs for nested properties. The module also provides a
 * collection helper that stores item refs and notifies subscribers when items are
 * inserted, removed, or changed.
 *
 * @since 4.0.0
 */
import * as Equal from "../../Equal.ts";
/**
 * The literal type used to identify `AtomRef` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export type TypeId = "~effect/reactivity/AtomRef";
/**
 * The runtime type id used to identify `AtomRef` values.
 *
 * @category type IDs
 * @since 4.0.0
 */
export declare const TypeId: TypeId;
/**
 * A read-only reactive reference.
 *
 * **Details**
 *
 * It exposes a stable key, the current value, subscriptions to value changes, and
 * `map` for creating derived read-only references. Equality and hashing are based
 * on the current value.
 *
 * @category models
 * @since 4.0.0
 */
export interface ReadonlyRef<A> extends Equal.Equal {
    readonly [TypeId]: TypeId;
    readonly key: string;
    readonly value: A;
    readonly subscribe: (f: (a: A) => void) => () => void;
    readonly map: <B>(f: (a: A) => B) => ReadonlyRef<B>;
}
/**
 * A mutable reactive reference.
 *
 * **Details**
 *
 * It supports replacing the whole value, updating it from the current value, and
 * creating mutable references to nested properties.
 *
 * @category models
 * @since 4.0.0
 */
export interface AtomRef<A> extends ReadonlyRef<A> {
    readonly prop: <K extends keyof A>(prop: K) => AtomRef<A[K]>;
    readonly set: (value: A) => AtomRef<A>;
    readonly update: (f: (value: A) => A) => AtomRef<A>;
}
/**
 * A reactive collection of mutable item references.
 *
 * **Details**
 *
 * The collection can push, insert, and remove item refs, and `toArray` returns the
 * current raw item values.
 *
 * @category models
 * @since 4.0.0
 */
export interface Collection<A> extends ReadonlyRef<ReadonlyArray<AtomRef<A>>> {
    readonly push: (item: A) => Collection<A>;
    readonly insertAt: (index: number, item: A) => Collection<A>;
    readonly remove: (ref: AtomRef<A>) => Collection<A>;
    readonly toArray: () => Array<A>;
}
/**
 * Creates a mutable reactive reference initialized with the supplied value.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: <A>(value: A) => AtomRef<A>;
/**
 * Creates a reactive collection from an iterable of initial item values.
 *
 * **Details**
 *
 * Each item is wrapped in an `AtomRef`, and changes to item refs notify the
 * collection subscribers.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const collection: <A>(items: Iterable<A>) => Collection<A>;
//# sourceMappingURL=AtomRef.d.ts.map