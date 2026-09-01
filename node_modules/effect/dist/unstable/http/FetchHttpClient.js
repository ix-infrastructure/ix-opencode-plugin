/**
 * Fetch-based implementation of the Effect HTTP client service.
 *
 * This module provides an `HttpClient` layer that executes requests through a
 * Web Fetch API implementation. It is the transport to use in browsers, edge
 * runtimes, and Node.js environments where `globalThis.fetch` is available, or
 * anywhere a compatible fetch function can be supplied.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Stream from "../../Stream.js";
import * as Headers from "./Headers.js";
import * as HttpClient from "./HttpClient.js";
import * as HttpClientError from "./HttpClientError.js";
import * as HttpClientResponse from "./HttpClientResponse.js";
/**
 * Context reference for the `fetch` implementation used by the fetch-based HTTP client.
 *
 * **Details**
 *
 * Defaults to `globalThis.fetch`.
 *
 * @category services
 * @since 4.0.0
 */
export const Fetch = /*#__PURE__*/Context.Reference("effect/http/FetchHttpClient/Fetch", {
  defaultValue: () => globalThis.fetch
});
/**
 * Service that contains default fetch options for the fetch-based HTTP client.
 *
 * **When to use**
 *
 * Use to provide default credentials, cache, redirect, integrity, or other
 * fetch options for outgoing HTTP requests.
 *
 * **Details**
 *
 * Request-specific method, headers, body, and abort signal are supplied by the client when a request is executed.
 *
 * @category services
 * @since 4.0.0
 */
export class RequestInit extends /*#__PURE__*/Context.Service()("effect/http/FetchHttpClient/RequestInit") {}
const fetch = /*#__PURE__*/HttpClient.make((request, url, signal, fiber) => {
  const fetch = fiber.getRef(Fetch);
  const options = fiber.context.mapUnsafe.get(RequestInit.key) ?? {};
  let headers = options.headers ? Headers.merge(Headers.fromInput(options.headers), request.headers) : request.headers;
  if (headers["content-length"]) {
    headers = Headers.remove(headers, "content-length");
  }
  const send = body => Effect.map(Effect.tryPromise({
    try: () => fetch(url, {
      ...options,
      method: request.method,
      headers,
      body,
      duplex: request.body._tag === "Stream" ? "half" : undefined,
      signal
    }),
    catch: cause => new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({
        request,
        cause
      })
    })
  }), response => HttpClientResponse.fromWeb(request, response));
  switch (request.body._tag) {
    case "Raw":
    case "Uint8Array":
      return send(request.body.body);
    case "FormData":
      return send(request.body.formData);
    case "Stream":
      return Effect.flatMap(Stream.toReadableStreamEffect(request.body.stream), send);
  }
  return send(undefined);
});
/**
 * Layer that provides an `HttpClient` implementation backed by the configured
 * `Fetch` function.
 *
 * **When to use**
 *
 * Use when an Effect program should execute `HttpClient` requests through the
 * platform `fetch` implementation, especially in browser, edge, or Node.js
 * runtimes with `globalThis.fetch`.
 *
 * **Details**
 *
 * The layer uses the current `Fetch` reference and optional `RequestInit`
 * service for each request. Request-specific method, headers, body, and abort
 * signal are supplied by the client and override matching `RequestInit` fields.
 *
 * **Gotchas**
 *
 * Fetch behavior comes from the runtime's implementation, so CORS, cookies,
 * redirects, abort handling, and streaming support can vary by platform. Stream
 * request bodies are sent as Web streams with `duplex: "half"`, and any
 * `content-length` header is removed before calling `fetch`.
 *
 * @see {@link Fetch} for supplying the fetch implementation used by this layer
 * @see {@link RequestInit} for default `RequestInit` options applied before request-specific fields
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = /*#__PURE__*/HttpClient.layerMergedContext(/*#__PURE__*/Effect.succeed(fetch));
//# sourceMappingURL=FetchHttpClient.js.map