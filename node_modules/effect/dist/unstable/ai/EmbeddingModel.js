/**
 * Defines the provider-neutral service for text embeddings.
 *
 * An `EmbeddingModel` turns text into numeric vectors. It supports single-input
 * embedding and ordered batch embedding, and represents provider failures as
 * `AiError` values. This module also includes the embedding dimensions service,
 * request and response models, usage metadata, provider contracts, and a
 * constructor that adapts a provider batch implementation into the service.
 * Single `embed` calls can be batched together internally.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Exit from "../../Exit.js";
import * as Request from "../../Request.js";
import * as RequestResolver from "../../RequestResolver.js";
import * as Schema from "../../Schema.js";
import * as AiError from "./AiError.js";
/**
 * Service tag for embedding model operations.
 *
 * **When to use**
 *
 * Use to retrieve or provide the embedding model service for an `Effect`
 * program that embeds text into vectors.
 *
 * @see {@link Service} for the service contract provided by this tag
 * @see {@link make} for constructing an embedding model service from a provider
 * @see {@link Dimensions} for the current embedding vector size service
 *
 * @category services
 * @since 4.0.0
 */
export class EmbeddingModel extends /*#__PURE__*/Context.Service()("effect/unstable/ai/EmbeddingModel") {}
/**
 * Service tag that provides the current embedding dimensions.
 *
 * **When to use**
 *
 * Use to retrieve or provide the configured embedding vector size through
 * context.
 *
 * @see {@link EmbeddingModel} for the embedding service that uses these dimensions
 *
 * @category services
 * @since 4.0.0
 */
export class Dimensions extends /*#__PURE__*/Context.Service()("effect/unstable/ai/EmbeddingModel/Dimensions") {}
/**
 * Represents token usage metadata for embedding operations.
 *
 * **Details**
 *
 * Contains optional provider-reported `inputTokens`. The value may be
 * `undefined` when the provider does not report usage or when `embedMany([])`
 * bypasses the provider.
 *
 * @category models
 * @since 4.0.0
 */
export class EmbeddingUsage extends /*#__PURE__*/Schema.Class("effect/ai/EmbeddingModel/EmbeddingUsage")({
  inputTokens: /*#__PURE__*/Schema.UndefinedOr(Schema.Finite)
}) {}
/**
 * Response for a single embedding request.
 *
 * @category models
 * @since 4.0.0
 */
export class EmbedResponse extends /*#__PURE__*/Schema.Class("effect/ai/EmbeddingModel/EmbedResponse")({
  vector: /*#__PURE__*/Schema.Array(Schema.Finite)
}) {}
/**
 * Response for batch embedding requests containing per-input embeddings and usage
 * metadata.
 *
 * **Details**
 *
 * `embeddings` preserves batch order, and `usage` carries token metadata for
 * the operation.
 *
 * @see {@link EmbedResponse} for individual embedding responses
 * @see {@link EmbeddingUsage} for token usage metadata
 *
 * @category models
 * @since 4.0.0
 */
export class EmbedManyResponse extends /*#__PURE__*/Schema.Class("effect/ai/EmbeddingModel/EmbedManyResponse")({
  embeddings: /*#__PURE__*/Schema.Array(EmbedResponse),
  usage: EmbeddingUsage
}) {}
/**
 * Represents a tagged request used by request resolvers for embedding operations.
 *
 * **When to use**
 *
 * Use when you need a typed request for one embedding input while building or
 * calling a low-level embedding request resolver.
 *
 * @see {@link Service} for the resolver-bearing service contract
 * @see {@link make} for constructing the request resolver from a provider implementation
 * @see {@link EmbedResponse} for the response produced by this request
 *
 * @category constructors
 * @since 4.0.0
 */
export class EmbeddingRequest extends /*#__PURE__*/Request.TaggedClass("EmbeddingRequest") {}
const invalidProviderResponse = description => AiError.make({
  module: "EmbeddingModel",
  method: "embedMany",
  reason: new AiError.InvalidOutputError({
    description
  })
});
/**
 * Creates an EmbeddingModel service from a provider embedMany implementation.
 *
 * **When to use**
 *
 * Use to adapt a provider's batch embedding implementation into an
 * `EmbeddingModel.Service` that offers single-input and batch embedding
 * operations.
 *
 * **Details**
 *
 * The returned service builds single-input `embed` calls through a request
 * resolver, so concurrent `embed` requests can be batched into one provider
 * `embedMany` call. Direct `embedMany` calls pass the input array to the
 * provider, while `embedMany([])` returns an empty response without calling the
 * provider.
 *
 * **Gotchas**
 *
 * Provider responses are interpreted positionally and must contain exactly one
 * result for each requested input. If the provider returns a different number
 * of results, `embed` and `embedMany` fail with `AiError.InvalidOutputError`.
 *
 * @see {@link Service} for the service shape returned by this constructor
 * @see {@link ProviderOptions} for the input passed to the provider implementation
 * @see {@link ProviderResponse} for the provider response contract consumed by this constructor
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = /*#__PURE__*/Effect.fnUntraced(function* (params) {
  const resolver = RequestResolver.make(entries => Effect.flatMap(params.embedMany({
    inputs: entries.map(entry => entry.request.input)
  }), response => Effect.map(mapProviderResults(entries.length, response.results), embeddings => {
    for (let i = 0; i < entries.length; i++) {
      entries[i].completeUnsafe(Exit.succeed(embeddings[i]));
    }
  }))).pipe(RequestResolver.withSpan("EmbeddingModel.resolver"));
  return EmbeddingModel.of({
    resolver,
    embed: input => Effect.request(new EmbeddingRequest({
      input
    }), resolver).pipe(Effect.withSpan("EmbeddingModel.embed")),
    embedMany: input => (input.length === 0 ? Effect.succeed(new EmbedManyResponse({
      embeddings: [],
      usage: new EmbeddingUsage({
        inputTokens: undefined
      })
    })) : params.embedMany({
      inputs: input
    }).pipe(Effect.flatMap(response => mapProviderResults(input.length, response.results).pipe(Effect.map(embeddings => new EmbedManyResponse({
      embeddings,
      usage: new EmbeddingUsage({
        inputTokens: response.usage.inputTokens
      })
    })))))).pipe(Effect.withSpan("EmbeddingModel.embedMany"))
  });
});
const mapProviderResults = (inputLength, results) => {
  const embeddings = new Array(inputLength);
  if (results.length !== inputLength) {
    return Effect.fail(invalidProviderResponse(`Provider returned ${results.length} embeddings but expected ${inputLength}`));
  }
  for (let i = 0; i < results.length; i++) {
    const vector = results[i];
    embeddings[i] = new EmbedResponse({
      vector
    });
  }
  return Effect.succeed(embeddings);
};
//# sourceMappingURL=EmbeddingModel.js.map