/**
 * Builds HTTP response text from template literals.
 *
 * Template interpolations can be plain values, optional values, effects, or
 * streams. The resulting effect or stream keeps the errors and service
 * requirements from any effectful interpolations, which lets response helpers
 * assemble dynamic text without losing type information.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js";
import * as Exit from "../../Exit.js";
import * as Option from "../../Option.js";
import * as Stream from "../../Stream.js";
/**
 * Creates an effectful string from a template literal.
 *
 * **Details**
 *
 * Primitive and `Option` interpolations are rendered immediately. Effect
 * interpolations are evaluated and rendered before the final string is produced.
 *
 * @category constructors
 * @since 4.0.0
 */
export function make(strings, ...args) {
  const argsLength = args.length;
  const values = new Array(argsLength);
  const effects = [];
  for (let i = 0; i < argsLength; i++) {
    const arg = args[i];
    if (Option.isOption(arg)) {
      values[i] = arg._tag === "Some" ? primitiveToString(arg.value) : "";
    } else if (isSuccess(arg)) {
      values[i] = primitiveToString(arg.value);
    } else if (Effect.isEffect(arg)) {
      effects.push([i, arg]);
    } else {
      values[i] = primitiveToString(arg);
    }
  }
  if (effects.length === 0) {
    return Effect.succeed(consolidate(strings, values));
  }
  return Effect.map(Effect.forEach(effects, ([index, effect]) => Effect.tap(effect, value => Effect.sync(() => {
    values[index] = primitiveToString(value);
  })), {
    concurrency: "inherit",
    discard: true
  }), _ => consolidate(strings, values));
}
/**
 * Creates a stream of strings from a template literal.
 *
 * **Details**
 *
 * Static text is emitted with interpolated values. Effect interpolations are
 * evaluated as stream chunks, and stream interpolations are flattened into the
 * output.
 *
 * @category constructors
 * @since 4.0.0
 */
export function stream(strings, ...args) {
  const chunks = [];
  let buffer = "";
  for (let i = 0, len = args.length; i < len; i++) {
    buffer += strings[i];
    const arg = args[i];
    if (Option.isOption(arg)) {
      buffer += arg._tag === "Some" ? primitiveToString(arg.value) : "";
    } else if (isSuccess(arg)) {
      buffer += primitiveToString(arg.value);
    } else if (Effect.isEffect(arg)) {
      if (buffer.length > 0) {
        chunks.push(buffer);
        buffer = "";
      }
      chunks.push(Effect.map(arg, primitiveToString));
    } else if (Stream.isStream(arg)) {
      if (buffer.length > 0) {
        chunks.push(buffer);
        buffer = "";
      }
      chunks.push(Stream.map(arg, primitiveToString));
    } else {
      buffer += primitiveToString(arg);
    }
  }
  buffer += strings[strings.length - 1];
  if (buffer.length > 0) {
    chunks.push(buffer);
    buffer = "";
  }
  return Stream.flatMap(Stream.fromIterable(chunks), chunk => typeof chunk === "string" ? Stream.succeed(chunk) : Effect.isEffect(chunk) ? Stream.fromEffect(chunk) : chunk, {
    concurrency: "unbounded"
  });
}
function primitiveToString(value) {
  if (Array.isArray(value)) {
    return value.map(primitiveToString).join("");
  }
  switch (typeof value) {
    case "string":
      {
        return value;
      }
    case "number":
    case "bigint":
      {
        return value.toString();
      }
    case "boolean":
      {
        return value ? "true" : "false";
      }
    default:
      {
        return "";
      }
  }
}
function consolidate(strings, values) {
  let out = "";
  for (let i = 0, len = values.length; i < len; i++) {
    out += strings[i];
    out += values[i];
  }
  return out + strings[strings.length - 1];
}
function isSuccess(u) {
  return Exit.isExit(u) && u._tag === "Success";
}
//# sourceMappingURL=Template.js.map