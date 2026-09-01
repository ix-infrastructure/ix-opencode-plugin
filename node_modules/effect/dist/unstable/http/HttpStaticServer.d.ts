/**
 * Serves static files for Effect HTTP applications.
 *
 * `HttpStaticServer` turns request paths into file responses under a configured
 * root directory. It can be used as an application value or mounted onto an
 * `HttpRouter`, and it handles index files, optional single-page application
 * fallback, MIME type headers, cache-control headers, byte ranges, and
 * conditional `304 Not Modified` responses.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts";
import * as FileSystem from "../../FileSystem.ts";
import * as Layer from "../../Layer.ts";
import * as Path from "../../Path.ts";
import type { PlatformError } from "../../PlatformError.ts";
import * as HttpPlatform from "./HttpPlatform.ts";
import * as HttpRouter from "./HttpRouter.ts";
import * as HttpServerError from "./HttpServerError.ts";
import * as HttpServerRequest from "./HttpServerRequest.ts";
import * as HttpServerResponse from "./HttpServerResponse.ts";
/**
 * Creates an `HttpApp` that serves files from a directory.
 *
 * **Example** (Serving files from a directory)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HttpStaticServer } from "effect/unstable/http"
 *
 * const program = Effect.gen(function*() {
 *   const app = yield* HttpStaticServer.make({ root: "./public" })
 *   return app
 * })
 * ```
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const make: (options: {
    readonly root: string;
    readonly index?: string | undefined;
    readonly spa?: boolean | undefined;
    readonly cacheControl?: string | undefined;
    readonly mimeTypes?: Record<string, string> | undefined;
}) => Effect.Effect<Effect.Effect<HttpServerResponse.HttpServerResponse, HttpServerError.HttpServerError, HttpServerRequest.HttpServerRequest>, PlatformError, FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform>;
/**
 * Creates a layer that mounts static files on an `HttpRouter`.
 *
 * **Example** (Mounting static files on a router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http"
 *
 * const ApiLayer = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"))
 *
 * const StaticFilesLayer = HttpStaticServer.layer({
 *   root: "./public",
 *   prefix: "/static"
 * })
 *
 * const AppLayer = Layer.mergeAll(ApiLayer, StaticFilesLayer)
 * ```
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layer: (options: {
    readonly root: string;
    readonly index?: string | undefined;
    readonly spa?: boolean | undefined;
    readonly cacheControl?: string | undefined;
    readonly mimeTypes?: Record<string, string> | undefined;
    readonly prefix?: string | undefined;
}) => Layer.Layer<never, PlatformError, HttpRouter.HttpRouter | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform>;
//# sourceMappingURL=HttpStaticServer.d.ts.map