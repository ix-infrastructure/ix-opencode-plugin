import * as Config from "../../../Config.ts";
export type Signal = "LOGS" | "METRICS" | "TRACES";
export declare const headers: (signal: Signal) => Config.Config<{
    readonly [x: string]: string;
} | undefined>;
export declare const endpoint: (signal: Signal) => Config.Config<URL | undefined>;
export declare const exporters: (signal: Signal) => Config.Config<readonly string[]>;
//# sourceMappingURL=otlpEnv.d.ts.map