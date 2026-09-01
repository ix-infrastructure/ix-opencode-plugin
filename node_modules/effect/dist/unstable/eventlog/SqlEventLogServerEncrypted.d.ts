/**
 * Stores encrypted event-log server state in SQL.
 *
 * This module provides the durable `Storage` implementation used by
 * `EventLogServerEncrypted` when entries should be stored without exposing
 * plaintext event data to the database. It persists the server remote id,
 * session authentication bindings, and encrypted entry tables, assigns stable
 * sequence numbers, and streams changes. Clients remain responsible for
 * encrypting writes and decrypting reads.
 *
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import type * as Scope from "../../Scope.ts";
import * as SqlClient from "../sql/SqlClient.ts";
import type * as SqlError from "../sql/SqlError.ts";
import * as EventLogEncryption from "./EventLogEncryption.ts";
import * as EventLogServerEncrypted from "./EventLogServerEncrypted.ts";
/**
 * Creates encrypted event-log server `Storage` backed by SQL.
 *
 * **Details**
 *
 * It persists the server remote id, session authentication bindings, and encrypted
 * entries in dialect-specific tables, creating per-identity/store entry tables as
 * needed.
 *
 * @category constructors
 * @since 4.0.0
 */
export declare const makeStorage: (options?: {
    readonly entryTablePrefix?: string;
    readonly remoteIdTable?: string;
    readonly insertBatchSize?: number;
}) => Effect.Effect<EventLogServerEncrypted.Storage["Service"], SqlError.SqlError, SqlClient.SqlClient | EventLogEncryption.EventLogEncryption | Scope.Scope>;
/**
 * Provides encrypted server `Storage` using the SQL-backed implementation.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerStorage: (options?: {
    readonly entryTablePrefix?: string;
    readonly remoteIdTable?: string;
    readonly insertBatchSize?: number;
}) => Layer.Layer<EventLogServerEncrypted.Storage, SqlError.SqlError, SqlClient.SqlClient | EventLogEncryption.EventLogEncryption>;
/**
 * Provides SQL-backed encrypted server `Storage` and supplies the default Web
 * Crypto `EventLogEncryption` layer.
 *
 * @category layers
 * @since 4.0.0
 */
export declare const layerStorageSubtle: (options?: {
    readonly entryTablePrefix?: string;
    readonly remoteIdTable?: string;
    readonly insertBatchSize?: number;
}) => Layer.Layer<EventLogServerEncrypted.Storage, SqlError.SqlError, SqlClient.SqlClient>;
//# sourceMappingURL=SqlEventLogServerEncrypted.d.ts.map