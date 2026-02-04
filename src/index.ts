/**
 * @titanpl/micro-gravity
 * TitanPL Test Sandbox - Execute real TitanPL code without mocking
 * 
 * Automatically discovers and loads TitanPL extensions from:
 * 1. The current project (if it has titan.json)
 * 2. Any package in node_modules with titan.json
 */

import koffi, { IKoffiLib } from 'koffi';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as v8 from 'node:v8';

// ============================================================================
// TYPES
// ============================================================================

export interface TitanExtension {
    name: string;
    path: string;
    titanJson: TitanJson;
    isLocal: boolean;
}

export interface TitanJson {
    name: string;
    main?: string;
    description?: string;
    version?: string;
    native?: {
        path: string;
        functions?: Record<string, NativeFunctionDef>;
        v8_functions?: Record<string, V8FunctionDef>;
    };
}

export interface NativeFunctionDef {
    symbol: string;
    parameters: string[];
    result: string;
}

export interface V8FunctionDef {
    symbol: string;
}

export interface MicroGravityOptions {
    /** Root directory to scan (default: process.cwd()) */
    rootDir?: string;
    /** Enable verbose logging (default: false) */
    verbose?: boolean;
    /** Custom logger function */
    logger?: (message: string) => void;
}

// ============================================================================
// TYPE MAPPING
// ============================================================================

const TYPE_MAP: Record<string, string> = {
    'string': 'str',
    'f64': 'double',
    'bool': 'bool',
    'void': 'void',
};

// ============================================================================
// DISCOVERY
// ============================================================================

/**
 * Discover all TitanPL extensions:
 * 1. Current project (if has titan.json) - highest priority
 * 2. Any package in node_modules with titan.json
 */
function discoverExtensions(rootDir: string, log: (msg: string) => void): TitanExtension[] {
    const found = new Map<string, TitanExtension>();

    // 1. Check current project first (has priority)
    const localTitanJson = path.join(rootDir, 'titan.json');
    if (fs.existsSync(localTitanJson)) {
        try {
            const titanJson = JSON.parse(fs.readFileSync(localTitanJson, 'utf8')) as TitanJson;
            const name = titanJson.name;

            if (name) {
                found.set(name, {
                    name,
                    path: rootDir,
                    titanJson,
                    isLocal: true,
                });
                log(`Found local extension: ${name}`);
            }
        } catch (e) {
            log(`Warning: Invalid titan.json in project root`);
        }
    }

    // 2. Scan node_modules
    const nodeModules = path.join(rootDir, 'node_modules');
    if (fs.existsSync(nodeModules)) {
        scanNodeModules(nodeModules, found, log);
    }

    return Array.from(found.values());
}

function scanNodeModules(
    dir: string,
    found: Map<string, TitanExtension>,
    log: (msg: string) => void
): void {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return;
    }

    for (const entry of entries) {
        // Skip hidden files and .bin
        if (entry.startsWith('.') || entry === '.bin') continue;

        const fullPath = path.join(dir, entry);

        try {
            if (!fs.statSync(fullPath).isDirectory()) continue;
        } catch {
            continue;
        }

        // Scoped packages (@org/pkg) - enter and scan
        if (entry.startsWith('@')) {
            scanNodeModules(fullPath, found, log);
            continue;
        }

        // Check for titan.json
        const titanJsonPath = path.join(fullPath, 'titan.json');
        if (fs.existsSync(titanJsonPath)) {
            try {
                const titanJson = JSON.parse(fs.readFileSync(titanJsonPath, 'utf8')) as TitanJson;
                const name = titanJson.name;

                // Only add if not exists (local project has priority)
                if (name && !found.has(name)) {
                    found.set(name, {
                        name,
                        path: fullPath,
                        titanJson,
                        isLocal: false,
                    });
                    log(`Found extension: ${name}`);
                }
            } catch {
                log(`Warning: Invalid titan.json in ${fullPath}`);
            }
        }

        // Scan nested node_modules (hoisting)
        const nested = path.join(fullPath, 'node_modules');
        if (fs.existsSync(nested)) {
            scanNodeModules(nested, found, log);
        }
    }
}

// ============================================================================
// DEPENDENCY SORTING
// ============================================================================

/**
 * Sort extensions by dependencies
 * Local project always loads last (depends on others)
 */
function sortByDependencies(extensions: TitanExtension[]): TitanExtension[] {
    const byName = new Map(extensions.map(e => [e.name, e]));
    const sorted: TitanExtension[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(ext: TitanExtension): void {
        if (visited.has(ext.name)) return;
        if (visiting.has(ext.name)) return; // Circular dependency

        visiting.add(ext.name);

        // Load dependencies first
        const pkgPath = path.join(ext.path, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const allDeps: Record<string, string> = {
                    ...pkg.dependencies,
                    ...pkg.peerDependencies,
                    ...pkg.devDependencies,
                };

                for (const depName of Object.keys(allDeps)) {
                    const dep = byName.get(depName);
                    if (dep) visit(dep);
                }
            } catch { }
        }

        visiting.delete(ext.name);
        visited.add(ext.name);
        sorted.push(ext);
    }

    // First node_modules extensions, then local
    const nodeModulesExts = extensions.filter(e => !e.isLocal);
    const localExt = extensions.find(e => e.isLocal);

    for (const ext of nodeModulesExts) {
        visit(ext);
    }

    if (localExt) {
        visit(localExt);
    }

    return sorted;
}

// ============================================================================
// EXTENSION LOADING
// ============================================================================

/** Keep track of loaded libraries to prevent unloading */
const loadedLibraries: IKoffiLib[] = [];

async function loadExtension(
    ext: TitanExtension,
    t: Record<string, any>,
    log: (msg: string) => void
): Promise<void> {
    const { name, path: extPath, titanJson, isLocal } = ext;
    const label = isLocal ? '(local)' : '';

    log(`Loading: ${name} ${label}`);

    // Initialize namespace
    t[name] = t[name] || {};

    // Load native DLL if exists
    if (titanJson.native?.path) {
        const dllPath = resolveDllPath(titanJson.native.path, extPath);

        if (fs.existsSync(dllPath)) {
            try {
                const lib = koffi.load(dllPath);
                loadedLibraries.push(lib); // Keep reference

                // Register native functions from titan.json
                if (titanJson.native.functions) {
                    for (const [fnName, def] of Object.entries(titanJson.native.functions)) {
                        const params = def.parameters.map((p: string) => TYPE_MAP[p] || p);
                        const result = TYPE_MAP[def.result] || def.result;

                        try {
                            t[name][fnName] = lib.func(def.symbol, result, params);
                        } catch (e) {
                            log(`Warning: Failed to load native function ${fnName}: ${e}`);
                        }
                    }
                }

                // V8 serialize/deserialize - use Node.js v8 module (same engine)
                if (titanJson.native.v8_functions) {
                    if ('serialize' in titanJson.native.v8_functions) {
                        t[name].serialize = v8.serialize;
                    }
                    if ('deserialize' in titanJson.native.v8_functions) {
                        t[name].deserialize = v8.deserialize;
                    }
                }

                log(`Loaded native: ${dllPath}`);
            } catch (e) {
                log(`Warning: Failed to load DLL ${dllPath}: ${e}`);
            }
        } else {
            log(`Warning: DLL not found: ${dllPath}`);
        }
    }

    // Load JS module
    const mainFile = titanJson.main || 'index.js';
    const mainPath = path.join(extPath, mainFile);

    if (fs.existsSync(mainPath)) {
        try {
            await import(mainPath);
            log(`Loaded JS: ${mainPath}`);
        } catch (e) {
            log(`Warning: Failed to load JS ${mainPath}: ${e}`);
        }
    }
}

function resolveDllPath(dllPath: string, extPath: string): string {
    if (path.isAbsolute(dllPath)) return dllPath;
    return path.join(extPath, dllPath);
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Initialize the TitanPL sandbox
 * 
 * @example
 * ```typescript
 * // vitest.setup.ts
 * import { bootstrap } from '@titanpl/micro-gravity';
 * await bootstrap();
 * ```
 */
export async function bootstrap(options: MicroGravityOptions = {}): Promise<void> {
    const {
        rootDir = process.cwd(),
        verbose = false,
        logger = console.log,
    } = options;

    const log = (msg: string) => {
        if (verbose) {
            logger(`[MicroGravity] ${msg}`);
        }
    };

    // 1. Create global t object
    const t: Record<string, any> = {
        log: (...args: any[]) => console.log('[Titan]', ...args),
        native: {},
    };

    (globalThis as any).t = t;
    (globalThis as any).Titan = t;

    // 2. Discover extensions
    const extensions = discoverExtensions(rootDir, log);

    if (extensions.length === 0) {
        log('No TitanPL extensions found');
        return;
    }

    const localCount = extensions.filter(e => e.isLocal).length;
    const depCount = extensions.filter(e => !e.isLocal).length;

    log(`Found ${extensions.length} extension(s): ${localCount} local, ${depCount} dependencies`);

    // 3. Sort by dependencies and load
    const sorted = sortByDependencies(extensions);

    for (const ext of sorted) {
        await loadExtension(ext, t, log);
    }

    log('Ready!');
}

/**
 * Get list of discovered extensions (for debugging)
 */
export function getLoadedExtensions(rootDir: string = process.cwd()): TitanExtension[] {
    return discoverExtensions(rootDir, () => { });
}

/**
 * Check if a specific extension is available
 */
export function hasExtension(name: string): boolean {
    return (globalThis as any).t?.[name] !== undefined;
}