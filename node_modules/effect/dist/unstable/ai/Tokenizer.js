/**
 * Service for model-specific token counting and prompt truncation. Tokenization
 * depends on the target provider, model, and encoding rules, so this module
 * leaves the actual tokenization function to the service implementation.
 *
 * The `Tokenizer` service can count tokens for raw prompt input and shorten a
 * prompt to a token limit by keeping the newest messages that fit. This module
 * defines the service tag, the service interface, and a `make` constructor that
 * builds a full tokenizer service from a token-counting function.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Predicate from "../../Predicate.js";
import * as Prompt from "./Prompt.js";
/**
 * Service tag for model tokenization services.
 *
 * **When to use**
 *
 * Use to access or provide model-specific token counting and prompt truncation
 * operations.
 *
 * **Details**
 *
 * This tag provides access to tokenization functionality throughout your
 * application, enabling token counting and prompt truncation capabilities.
 *
 * **Example** (Accessing the Tokenizer service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Tokenizer } from "effect/unstable/ai"
 *
 * const useTokenizer = Effect.gen(function*() {
 *   const tokenizer = yield* Tokenizer.Tokenizer
 *   const tokens = yield* tokenizer.tokenize("Hello, world!")
 *   return tokens.length
 * })
 * ```
 *
 * @category services
 * @since 4.0.0
 */
export class Tokenizer extends /*#__PURE__*/Context.Service()("effect/ai/Tokenizer") {}
/**
 * Creates a Tokenizer service implementation from tokenization options.
 *
 * **Details**
 *
 * This function constructs a complete Tokenizer service by providing a
 * tokenization function. The service handles both tokenization and
 * truncation operations using the provided tokenizer.
 *
 * **Example** (Creating a word tokenizer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Tokenizer } from "effect/unstable/ai"
 *
 * // Simple word-based tokenizer
 * const wordTokenizer = Tokenizer.make({
 *   tokenize: (prompt) =>
 *     Effect.succeed(
 *       prompt.content
 *         .flatMap((msg) =>
 *           typeof msg.content === "string"
 *             ? msg.content.split(" ")
 *             : msg.content.flatMap((part) =>
 *               part.type === "text" ? part.text.split(" ") : []
 *             )
 *         )
 *         .map((_, index) => index)
 *     )
 * })
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = options => Tokenizer.of({
  tokenize(input) {
    return options.tokenize(Prompt.make(input));
  },
  truncate(input, tokens) {
    return truncate(Prompt.make(input), options.tokenize, tokens);
  }
});
const truncate = (self, tokenize, maxTokens) => Effect.suspend(() => {
  let count = 0;
  let inputMessages = self.content;
  let outputMessages = [];
  const loop = Effect.suspend(() => {
    const message = inputMessages[inputMessages.length - 1];
    if (Predicate.isUndefined(message)) {
      return Effect.succeed(Prompt.fromMessages(outputMessages));
    }
    inputMessages = inputMessages.slice(0, inputMessages.length - 1);
    return Effect.flatMap(tokenize(Prompt.fromMessages([message])), tokens => {
      count += tokens.length;
      if (count > maxTokens) {
        return Effect.succeed(Prompt.fromMessages(outputMessages));
      }
      outputMessages = [message, ...outputMessages];
      return loop;
    });
  });
  return loop;
});
//# sourceMappingURL=Tokenizer.js.map