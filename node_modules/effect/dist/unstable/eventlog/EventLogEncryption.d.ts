/**
 * Cryptographic service for encrypted event-log replication.
 *
 * `EventLogEncryption` turns local journal entries into encrypted remote
 * payloads and decrypts encrypted changes received from a server. It also
 * hashes byte data and creates event-log identities, so remote replication can
 * use storage or transport that should not see plaintext event data.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Effect from "../../Effect.ts";
import * as Layer from "../../Layer.ts";
import * as Schema from "../../Schema.ts";
import * as Transferable from "../workers/Transferable.ts";
import { Entry, RemoteEntry } from "./EventJournal.ts";
import type { Identity } from "./EventLog.ts";
/**
 * Schema for an encrypted journal entry paired with the id of the original
 * entry.
 *
 * @category models
 * @since 4.0.0
 */
export declare const EncryptedEntry: Schema.Struct<{
    readonly entryId: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>, "effect/eventlog/EventJournal/EntryId">;
    readonly encryptedEntry: Transferable.Transferable<Schema.instanceOf<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>>;
}>;
/**
 * Type of an encrypted remote entry, including its remote sequence number,
 * initialization vector, entry id, and encrypted entry bytes.
 *
 * @category models
 * @since 4.0.0
 */
export interface EncryptedRemoteEntry extends Schema.Schema.Type<typeof EncryptedRemoteEntry> {
}
/**
 * Schema for encrypted entries exchanged with a remote event-log server.
 *
 * @category models
 * @since 4.0.0
 */
export declare const EncryptedRemoteEntry: Schema.Struct<{
    readonly sequence: Schema.Number;
    readonly iv: Transferable.Transferable<Schema.instanceOf<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>>;
    readonly entryId: Schema.brand<Schema.instanceOf<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>, "effect/eventlog/EventJournal/EntryId">;
    readonly encryptedEntry: Transferable.Transferable<Schema.instanceOf<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>>;
}>;
declare const EventLogEncryption_base: Context.ServiceClass<EventLogEncryption, "effect/eventlog/EventLogEncryption", {
    readonly encrypt: (identity: Identity["Service"], entries: ReadonlyArray<Entry>) => Effect.Effect<{
        readonly iv: Uint8Array<ArrayBuffer>;
        readonly encryptedEntries: ReadonlyArray<Uint8Array<ArrayBuffer>>;
    }>;
    readonly decrypt: (identity: Identity["Service"], entries: ReadonlyArray<EncryptedRemoteEntry>) => Effect.Effect<Array<RemoteEntry>>;
    readonly sha256String: (data: Uint8Array) => Effect.Effect<string>;
    readonly sha256: (data: Uint8Array) => Effect.Effect<Uint8Array>;
    readonly generateIdentity: Effect.Effect<Identity["Service"]>;
}>;
/**
 * Service that provides identity generation, entry
 * encryption and decryption, and SHA-256 hashing for event-log replication.
 *
 * **When to use**
 *
 * Use to provide cryptographic operations required by encrypted event-log
 * replication.
 *
 * @category services
 * @since 4.0.0
 */
export declare class EventLogEncryption extends EventLogEncryption_base {
}
/**
 * Creates an `EventLogEncryption` service backed by the Web Crypto `SubtleCrypto`
 * APIs from the supplied `Crypto` implementation.
 *
 * @category encryption
 * @since 4.0.0
 */
export declare const makeEncryptionSubtle: (crypto: Crypto) => Effect.Effect<EventLogEncryption["Service"]>;
/**
 * Provides `EventLogEncryption` using `globalThis.crypto`.
 *
 * @category encryption
 * @since 4.0.0
 */
export declare const layerSubtle: Layer.Layer<EventLogEncryption>;
export {};
//# sourceMappingURL=EventLogEncryption.d.ts.map