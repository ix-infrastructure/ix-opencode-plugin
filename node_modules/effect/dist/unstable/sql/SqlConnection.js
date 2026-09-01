/**
 * Low-level SQL connection contract used by driver integrations.
 *
 * A `Connection` is the driver-facing layer under `SqlClient`. It executes
 * already-compiled SQL with positional parameters and can return transformed
 * rows, raw driver results, streams, value arrays, or unprepared statement
 * results. This module also defines the scoped connection acquirer type, the
 * connection service tag, and the generic row shape.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.js";
/**
 * Service tag for a low-level SQL `Connection`.
 *
 * @category services
 * @since 4.0.0
 */
export const Connection = /*#__PURE__*/Context.Service("effect/sql/SqlConnection");
//# sourceMappingURL=SqlConnection.js.map