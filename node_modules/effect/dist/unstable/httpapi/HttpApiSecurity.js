/**
 * Defines security scheme declarations for declarative HTTP APIs.
 *
 * Security schemes describe where credentials are read from and which credential
 * type is passed to security middleware. They are consumed by
 * `HttpApiMiddleware.Service`, `HttpApiBuilder`, generated clients, and OpenAPI
 * generation, but they do not authenticate requests by themselves.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
import { dual } from "../../Function.js";
import { pipeArguments } from "../../Pipeable.js";
const TypeId = "~effect/httpapi/HttpApiSecurity";
const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
/**
 * Creates a Http token security scheme.
 *
 * **When to use**
 *
 * Use to require `Authorization: scheme ...` credentials for an HTTP API group
 * or endpoint.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * @see {@link apiKey} for an API-key security scheme
 * @see {@link basic} for an HTTP Basic security scheme
 * @category constructors
 * @since 4.0.0
 */
export const http = options => Object.assign(Object.create(Proto), {
  _tag: "Http",
  scheme: options.scheme,
  schemeLength: options.scheme.length,
  annotations: Context.empty()
});
/**
 * Creates a Bearer token security scheme.
 *
 * **When to use**
 *
 * Use to require `Authorization: Bearer ...` credentials for an HTTP API group
 * or endpoint.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * @see {@link apiKey} for an API-key security scheme
 * @see {@link basic} for an HTTP Basic security scheme
 * @category constructors
 * @since 4.0.0
 */
export const bearer = /*#__PURE__*/http({
  scheme: "Bearer"
});
/**
 * Creates an API key security scheme.
 *
 * **When to use**
 *
 * Use to require API key credentials passed through a header, query parameter,
 * or cookie.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * Use `HttpApiBuilder.securitySetCookie` to set the correct cookie in a
 * handler. By default, `in` is `"header"`.
 *
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link basic} for an HTTP Basic security scheme
 * @category constructors
 * @since 4.0.0
 */
export const apiKey = options => Object.assign(Object.create(Proto), {
  _tag: "ApiKey",
  key: options.key,
  in: options.in ?? "header",
  annotations: Context.empty()
});
/**
 * Creates an HTTP Basic authentication security scheme.
 *
 * **When to use**
 *
 * Use to require HTTP Basic username/password credentials.
 *
 * **Details**
 *
 * Use `HttpApiBuilder.middlewareSecurity` to implement API middleware for this
 * security scheme.
 *
 * @see {@link bearer} for a Bearer token security scheme
 * @see {@link apiKey} for an API-key security scheme
 * @category constructors
 * @since 4.0.0
 */
export const basic = /*#__PURE__*/Object.assign(/*#__PURE__*/Object.create(Proto), {
  _tag: "Basic",
  annotations: /*#__PURE__*/Context.empty()
});
/**
 * Merges OpenAPI annotations into a security scheme.
 *
 * @category annotations
 * @since 4.0.0
 */
export const annotateMerge = /*#__PURE__*/dual(2, (self, annotations) => Object.assign(Object.create(Proto), {
  ...self,
  annotations: Context.merge(self.annotations, annotations)
}));
/**
 * Adds an OpenAPI annotation value to a security scheme.
 *
 * @category annotations
 * @since 4.0.0
 */
export const annotate = /*#__PURE__*/dual(3, (self, service, value) => Object.assign(Object.create(Proto), {
  ...self,
  annotations: Context.add(self.annotations, service, value)
}));
//# sourceMappingURL=HttpApiSecurity.js.map