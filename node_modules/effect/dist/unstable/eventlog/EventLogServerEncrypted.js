/**
 * Serves encrypted event-log replication.
 *
 * Encrypted `EventLogRemote` clients use this module when they need a remote
 * synchronization endpoint that never sees plaintext events. The server stores
 * encrypted entries and replication metadata keyed by client public key and
 * store id, then streams encrypted changes back to clients for local
 * decryption. This module defines the RPC handlers, server layer, storage
 * contract, and in-memory storage layer for that encrypted server path.
 *
 * @since 4.0.0
 */
import * as Uuid from "uuid";
import * as Arr from "../../Array.js";
import * as Context from "../../Context.js";
import * as Effect from "../../Effect.js";
import * as Layer from "../../Layer.js";
import * as PubSub from "../../PubSub.js";
import * as RcMap from "../../RcMap.js";
import * as Schema from "../../Schema.js";
import * as Stream from "../../Stream.js";
import * as RpcServer from "../rpc/RpcServer.js";
import * as Transferable from "../workers/Transferable.js";
import { EntryId, makeRemoteIdUnsafe } from "./EventJournal.js";
import { ChangesRpc, EventLogProtocolError, EventLogRemoteRpcs, WriteEntries } from "./EventLogMessage.js";
import * as EventLogServer from "./EventLogServer.js";
/**
 * Provides RPC handlers for the encrypted event-log server.
 *
 * **Details**
 *
 * Incoming encrypted write payloads are decoded and persisted through `Storage`;
 * change streams read encrypted entries from storage and encode them for the
 * remote protocol.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerRpcHandlers = /*#__PURE__*/Layer.unwrap(/*#__PURE__*/Effect.gen(function* () {
  const storage = yield* Storage;
  const remoteId = yield* storage.getId;
  return EventLogServer.layerRpcHandlers({
    remoteId,
    getOrCreateSessionAuthBinding: (publicKey, signingPublicKey) => storage.getOrCreateSessionAuthBinding(publicKey, signingPublicKey),
    onWrite: Effect.fnUntraced(function* (data) {
      const request = yield* WriteEntries.decode(data).pipe(Effect.mapError(_ => new EventLogProtocolError({
        requestTag: "WriteEntries",
        publicKey: undefined,
        code: "InternalServerError",
        message: "Decoding failure"
      })));
      if (request.encryptedEntries.length === 0) return;
      const entries = request.encryptedEntries.map(({
        encryptedEntry,
        entryId
      }) => new PersistedEntry({
        entryId,
        iv: request.iv,
        encryptedEntry
      }));
      return yield* storage.write(request.publicKey, request.storeId, entries).pipe(Effect.catchCause(_ => Effect.fail(new EventLogProtocolError({
        requestTag: "WriteEntries",
        publicKey: request.publicKey,
        code: "InternalServerError",
        message: "Persistence failure"
      }))));
    }),
    changes: ({
      publicKey,
      storeId,
      startSequence
    }) => storage.changes(publicKey, storeId, startSequence).pipe(Stream.mapArrayEffect(entries => Effect.map(ChangesRpc.encodeEncrypted(entries), Arr.of)))
  });
}));
/**
 * Provides an encrypted event-log RPC server using `EventLogRemoteRpcs` and the
 * encrypted server RPC handlers.
 *
 * **When to use**
 *
 * Use when you need an encrypted event-log RPC server for encrypted
 * `EventLogRemote` replication over an existing `RpcServer.Protocol`.
 *
 * **Details**
 *
 * This layer installs `EventLogRemoteRpcs` on the provided RPC server protocol
 * and wires those RPCs to `layerRpcHandlers`. Encrypted entries, session
 * authentication bindings, remote ids, and change streams are delegated to
 * `Storage`.
 *
 * @see {@link layerRpcHandlers} for the encrypted handler layer without installing an RPC server protocol
 * @see {@link Storage} for the storage service required by this layer
 * @see {@link layerStorageMemory} for the process-local in-memory storage layer
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = /*#__PURE__*/RpcServer.layer(EventLogRemoteRpcs).pipe(/*#__PURE__*/Layer.provide(layerRpcHandlers));
/**
 * Schema for encrypted entries persisted by the encrypted event-log server.
 *
 * @category storage
 * @since 4.0.0
 */
export class PersistedEntry extends /*#__PURE__*/Schema.Class("effect/eventlog/EventLogServerEncrypted/PersistedEntry")({
  entryId: EntryId,
  iv: Transferable.Uint8Array,
  encryptedEntry: Transferable.Uint8Array
}) {
  /**
   * String representation of the encrypted entry id.
   *
   * @since 4.0.0
   */
  get entryIdString() {
    return Uuid.stringify(this.entryId);
  }
}
/**
 * Defines the backing store service used by the encrypted event-log server.
 *
 * **When to use**
 *
 * Use to provide durable encrypted event-log persistence for an encrypted
 * event-log server layer.
 *
 * **Details**
 *
 * It provides the server remote id, stores session authentication bindings,
 * persists encrypted entries, and streams encrypted changes for a public key and
 * store id.
 *
 * @category storage
 * @since 4.0.0
 */
export class Storage extends /*#__PURE__*/Context.Service()("effect/eventlog/EventLogServer/Storage") {}
/**
 * Creates an in-memory encrypted server `Storage`.
 *
 * **Details**
 *
 * Data, session authentication bindings, and streams are process-local and are
 * released with the surrounding scope.
 *
 * @category storage
 * @since 4.0.0
 */
export const makeStorageMemory = /*#__PURE__*/Effect.gen(function* () {
  const knownIds = new Map();
  const journals = new Map();
  const sessionAuthBindings = new Map();
  const remoteId = makeRemoteIdUnsafe();
  const ensureKnownIds = scopeKey => {
    let storeKnownIds = knownIds.get(scopeKey);
    if (storeKnownIds) return storeKnownIds;
    storeKnownIds = new Map();
    knownIds.set(scopeKey, storeKnownIds);
    return storeKnownIds;
  };
  const ensureJournal = scopeKey => {
    let journal = journals.get(scopeKey);
    if (journal) return journal;
    journal = [];
    journals.set(scopeKey, journal);
    return journal;
  };
  const pubsubs = yield* RcMap.make({
    lookup: _scopeKey => Effect.acquireRelease(PubSub.unbounded(), PubSub.shutdown),
    idleTimeToLive: 60000
  });
  return Storage.of({
    getId: Effect.succeed(remoteId),
    getOrCreateSessionAuthBinding: (publicKey, signingPublicKey) => Effect.sync(() => {
      let existing = sessionAuthBindings.get(publicKey);
      if (existing) return existing;
      sessionAuthBindings.set(publicKey, signingPublicKey);
      return signingPublicKey;
    }),
    write: Effect.fnUntraced(function* (publicKey, storeId, entries) {
      const scopeKey = makeEncryptedScopeKey({
        publicKey,
        storeId
      });
      const pubsub = yield* RcMap.get(pubsubs, scopeKey);
      const storeKnownIds = ensureKnownIds(scopeKey);
      const journal = ensureJournal(scopeKey);
      const encryptedEntries = [];
      for (const entry of entries) {
        const idString = entry.entryIdString;
        if (storeKnownIds.has(idString)) continue;
        const encrypted = {
          sequence: journal.length,
          entryId: entry.entryId,
          iv: entry.iv,
          encryptedEntry: entry.encryptedEntry
        };
        encryptedEntries.push(encrypted);
        storeKnownIds.set(idString, encrypted.sequence);
        journal.push(encrypted);
        PubSub.publishUnsafe(pubsub, encrypted);
      }
      return encryptedEntries;
    }, Effect.scoped),
    changes: Effect.fnUntraced(function* (publicKey, storeId, startSequence) {
      const scopeKey = makeEncryptedScopeKey({
        publicKey,
        storeId
      });
      const pubsub = yield* RcMap.get(pubsubs, scopeKey);
      const subscription = yield* PubSub.subscribe(pubsub);
      return Stream.fromArray(ensureJournal(scopeKey).slice(startSequence)).pipe(Stream.concat(Stream.fromSubscription(subscription)));
    }, Stream.unwrap)
  });
});
/**
 * Provides encrypted server `Storage` using the in-memory implementation.
 *
 * @category storage
 * @since 4.0.0
 */
export const layerStorageMemory = /*#__PURE__*/Layer.effect(Storage)(makeStorageMemory);
const makeEncryptedScopeKey = ({
  publicKey,
  storeId
}) => {
  return `${publicKey}/${storeId}`;
};
//# sourceMappingURL=EventLogServerEncrypted.js.map