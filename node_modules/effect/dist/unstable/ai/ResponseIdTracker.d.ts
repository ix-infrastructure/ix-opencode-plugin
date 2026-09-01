/**
 * Track provider response IDs for incremental language model calls.
 *
 * Some providers can continue from a prior response by accepting a
 * `previousResponseId` plus only the messages added after that response. This
 * module exposes a small mutable service that remembers which prompt message
 * objects were included in each provider response and prepares a shorter prompt
 * when a later call extends the same conversation.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Effect from "../../Effect.ts";
import * as Option from "../../Option.ts";
import * as Prompt from "./Prompt.ts";
/**
 * Result returned when a tracked prompt can be sent incrementally.
 *
 * **Details**
 *
 * It contains the provider response ID to pass as `previousResponseId` and the
 * prompt fragment containing only the new messages after the latest assistant
 * turn.
 *
 * @category models
 * @since 4.0.0
 */
export interface PrepareResult {
    readonly previousResponseId: string;
    readonly prompt: Prompt.Prompt;
}
/**
 * Mutable service that tracks prompt message object identities by provider
 * response ID.
 *
 * **Details**
 *
 * `markParts` records the prompt messages that produced a response,
 * `prepareUnsafe` returns a `previousResponseId` plus the untracked suffix when
 * the prompt prefix is fully recognized, and `clearUnsafe` drops all tracked
 * state.
 *
 * @category models
 * @since 4.0.0
 */
export interface Service {
    clearUnsafe(): void;
    markParts(parts: ReadonlyArray<object>, responseId: string): void;
    prepareUnsafe(prompt: Prompt.Prompt): Option.Option<PrepareResult>;
}
declare const ResponseIdTracker_base: Context.ServiceClass<ResponseIdTracker, "effect/ai/ResponseIdTracker", Service>;
/**
 * Service tag for enabling provider previous-response ID reuse across language
 * model calls.
 *
 * **When to use**
 *
 * Use when you provide a language model with previous-response ID tracking so
 * later calls can send only new prompt messages together with the provider's
 * prior response ID.
 *
 * @category services
 * @since 4.0.0
 */
export declare class ResponseIdTracker extends ResponseIdTracker_base {
}
/**
 * Creates an in-memory `ResponseIdTracker` service.
 *
 * **Details**
 *
 * The tracker maps prompt message object identities to provider response IDs.
 * `prepareUnsafe` returns a previous response ID and the messages after the
 * latest assistant turn only when the existing prompt prefix is fully tracked;
 * otherwise it clears the tracked state and returns `Option.none()`.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: Effect.Effect<Service>;
export {};
//# sourceMappingURL=ResponseIdTracker.d.ts.map