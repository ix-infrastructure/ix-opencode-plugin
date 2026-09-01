/**
 * Adds OpenTelemetry GenAI attributes to Effect AI spans.
 *
 * This module models the `gen_ai.*` attributes used by language model and
 * embedding providers. It includes attribute types, helpers for writing
 * non-null attributes onto existing spans, and a `CurrentSpanTransformer`
 * service for adding custom span annotations from provider options and response
 * parts.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import { dual } from "../../Function.js";
import * as Predicate from "../../Predicate.js";
import * as String from "../../String.js";
/**
 * Creates a reusable span-attribute writer for a key prefix and key
 * transformer.
 *
 * **Details**
 *
 * The returned function mutates the supplied span by adding each non-nullish
 * attribute as `${prefix}.${transformedKey}`.
 *
 * **Example** (Adding prefixed span attributes)
 *
 * ```ts
 * import { String } from "effect"
 * import type { Tracer } from "effect"
 * import { Telemetry } from "effect/unstable/ai"
 *
 * const addCustomAttributes = Telemetry.addSpanAttributes(
 *   "custom.ai",
 *   String.camelToSnake
 * )
 *
 * // Usage with a span
 * declare const span: Tracer.Span
 * addCustomAttributes(span, {
 *   modelName: "gpt-4",
 *   maxTokens: 1000
 * })
 * // Results in attributes: "custom.ai.model_name" and "custom.ai.max_tokens"
 * ```
 *
 * @category annotations
 * @since 4.0.0
 */
export const addSpanAttributes = (
/**
 * The prefix to add to all attribute keys.
 */
keyPrefix,
/**
 * Function to transform attribute keys (e.g., camelCase to snake_case).
 */
transformKey) => (
/**
 * The OpenTelemetry span to add attributes to.
 */
span,
/**
 * The attributes to add to the span.
 */
attributes) => {
  for (const [key, value] of Object.entries(attributes)) {
    if (Predicate.isNotNullish(value)) {
      span.attribute(`${keyPrefix}.${transformKey(key)}`, value);
    }
  }
};
const addSpanBaseAttributes = /*#__PURE__*/addSpanAttributes("gen_ai", String.camelToSnake);
const addSpanOperationAttributes = /*#__PURE__*/addSpanAttributes("gen_ai.operation", String.camelToSnake);
const addSpanRequestAttributes = /*#__PURE__*/addSpanAttributes("gen_ai.request", String.camelToSnake);
const addSpanResponseAttributes = /*#__PURE__*/addSpanAttributes("gen_ai.response", String.camelToSnake);
const addSpanTokenAttributes = /*#__PURE__*/addSpanAttributes("gen_ai.token", String.camelToSnake);
const addSpanUsageAttributes = /*#__PURE__*/addSpanAttributes("gen_ai.usage", String.camelToSnake);
/**
 * Applies GenAI telemetry attributes to an OpenTelemetry span.
 *
 * **When to use**
 *
 * Use when you need to write GenAI request, response, token, or usage
 * attributes onto an existing OpenTelemetry span.
 *
 * **Details**
 *
 * This function adds standardized GenAI attributes to a span following
 * OpenTelemetry semantic conventions.
 *
 * **Gotchas**
 *
 * This function mutates the provided span in-place.
 *
 * **Example** (Adding GenAI telemetry annotations)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Telemetry } from "effect/unstable/ai"
 *
 * const directUsage = Effect.gen(function*() {
 *   const span = yield* Effect.currentSpan
 *
 *   Telemetry.addGenAIAnnotations(span, {
 *     system: "openai",
 *     request: { model: "gpt-4", temperature: 0.7 },
 *     usage: { inputTokens: 100, outputTokens: 50 }
 *   })
 * })
 * ```
 *
 * @category annotations
 * @since 4.0.0
 */
export const addGenAIAnnotations = /*#__PURE__*/dual(2, (span, options) => {
  addSpanBaseAttributes(span, {
    system: options.system
  });
  if (Predicate.isNotNullish(options.operation)) addSpanOperationAttributes(span, options.operation);
  if (Predicate.isNotNullish(options.request)) addSpanRequestAttributes(span, options.request);
  if (Predicate.isNotNullish(options.response)) addSpanResponseAttributes(span, options.response);
  if (Predicate.isNotNullish(options.token)) addSpanTokenAttributes(span, options.token);
  if (Predicate.isNotNullish(options.usage)) addSpanUsageAttributes(span, options.usage);
});
/**
 * Service tag for providing a `SpanTransformer` to large language model
 * operations.
 *
 * **When to use**
 *
 * Use to retrieve or provide the current `SpanTransformer` through context for
 * language model span annotation.
 *
 * @see {@link SpanTransformer} for the transformer contract provided by this service
 *
 * @category services
 * @since 4.0.0
 */
export class CurrentSpanTransformer extends /*#__PURE__*/Context.Service()("effect/ai/Telemetry/CurrentSpanTransformer") {}
//# sourceMappingURL=Telemetry.js.map