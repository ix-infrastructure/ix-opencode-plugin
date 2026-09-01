/**
 * Builds SQL repositories and request resolvers from Effect schema models.
 *
 * Use this module when a schema `Model` represents rows in a SQL table and the
 * usual insert, update, find-by-id, delete, and batching behavior should be
 * derived from that model. The helpers encode insert and update input with the
 * model's input schemas and decode returned rows with the full model schema.
 * Soft deletes are optional, and SQL dialect differences such as `returning`
 * support are handled by the repository implementation.
 *
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts";
import * as Effect from "../../Effect.ts";
import * as RequestResolver from "../../RequestResolver.ts";
import type * as Schema from "../../Schema.ts";
import type { Scope } from "../../Scope.ts";
import type * as Model from "../schema/Model.ts";
import { SqlClient } from "./SqlClient.ts";
import type { ResultLengthMismatch, SqlError } from "./SqlError.ts";
import * as SqlResolver from "./SqlResolver.ts";
/**
 * Creates a CRUD repository for a schema model backed by a SQL table, with
 * insert, update, find-by-id, and delete operations. When `softDeleteColumn` is
 * supplied, reads ignore soft-deleted rows and delete updates that column
 * instead of removing the row.
 *
 * @category repository
 * @since 4.0.0
 */
export declare const makeRepository: <S extends Model.Any, Id extends (keyof S["Type"]) & (keyof S["update"]["Type"]) & (keyof S["fields"]), SoftDelete extends keyof S["fields"] = never>(Model: S, options: {
    readonly tableName: string;
    readonly spanPrefix: string;
    readonly idColumn: Id;
    readonly softDeleteColumn?: SoftDelete | undefined;
}) => Effect.Effect<{
    readonly insert: (insert: S["insert"]["Type"]) => Effect.Effect<S["Type"], Schema.SchemaError | SqlError, S["DecodingServices"] | S["insert"]["EncodingServices"]>;
    readonly insertVoid: (insert: S["insert"]["Type"]) => Effect.Effect<void, Schema.SchemaError | SqlError, S["insert"]["EncodingServices"]>;
    readonly update: (update: S["update"]["Type"]) => Effect.Effect<S["Type"], Schema.SchemaError | SqlError, S["DecodingServices"] | S["update"]["EncodingServices"]>;
    readonly updateVoid: (update: S["update"]["Type"]) => Effect.Effect<void, Schema.SchemaError | SqlError, S["update"]["EncodingServices"]>;
    readonly findById: (id: S["fields"][Id]["Type"]) => Effect.Effect<S["Type"], Cause.NoSuchElementError | Schema.SchemaError | SqlError, S["DecodingServices"] | S["fields"][Id]["EncodingServices"]>;
    readonly delete: (id: S["fields"][Id]["Type"]) => Effect.Effect<void, Schema.SchemaError | SqlError, S["fields"][Id]["EncodingServices"]>;
}, never, SqlClient>;
/**
 * Creates batched request resolvers for a schema model's insert, insert-void,
 * find-by-id, and delete operations, honoring the optional soft-delete column.
 *
 * @category repository
 * @since 4.0.0
 */
export declare const makeResolvers: <S extends Model.Any, Id extends (keyof S["Type"]) & (keyof S["update"]["Type"]) & (keyof S["fields"]), SoftDelete extends keyof S["fields"] = never>(Model: S, options: {
    readonly tableName: string;
    readonly spanPrefix: string;
    readonly idColumn: Id;
    readonly softDeleteColumn?: SoftDelete | undefined;
}) => Effect.Effect<{
    readonly insert: RequestResolver.RequestResolver<SqlResolver.SqlRequest<S["insert"]["Type"], S["Type"], ResultLengthMismatch | SqlError, S["insert"]["EncodingServices"]>>;
    readonly insertVoid: RequestResolver.RequestResolver<SqlResolver.SqlRequest<S["insert"]["Type"], void, SqlError, S["insert"]["EncodingServices"]>>;
    readonly findById: RequestResolver.RequestResolver<SqlResolver.SqlRequest<S["fields"][Id]["Type"], S["Type"], Cause.NoSuchElementError | SqlError, S["DecodingServices"] | S["fields"][Id]["EncodingServices"]>>;
    readonly delete: RequestResolver.RequestResolver<SqlResolver.SqlRequest<S["fields"][Id]["Type"], void, SqlError, S["fields"][Id]["EncodingServices"]>>;
}, never, SqlClient | Scope>;
//# sourceMappingURL=SqlModel.d.ts.map