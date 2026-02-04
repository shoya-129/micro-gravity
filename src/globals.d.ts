/**
 * Global type declarations for TitanPL sandbox
 * 
 * Add to your tsconfig.json:
 * ```json
 * {
 *   "compilerOptions": {
 *     "types": ["@titanpl/micro-gravity/globals"]
 *   }
 * }
 * ```
 * 
 * Or use triple-slash reference:
 * ```typescript
 * /// <reference types="@titanpl/micro-gravity/globals" />
 * ```
 */

/**
 * Base Titan Runtime interface
 * Extensions augment this via declaration merging
 */
interface TitanRuntime {
    /** Log to console with [Titan] prefix */
    log(...args: any[]): void;

    /** Native functions namespace */
    native: Record<string, Function>;

    /** Extension namespaces - indexed by extension name */
    [extensionName: string]: any;
}

declare global {
    /**
     * TitanPL Runtime object - available globally after bootstrap
     */
    var t: TitanRuntime;

    /**
     * Alias for t
     */
    var Titan: TitanRuntime;
}

export { TitanRuntime };