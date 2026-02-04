# 🌑 Micro-Gravity

**TitanPL Test Sandbox** - Execute real TitanPL code in your tests without mocking.

Micro-Gravity automatically discovers and loads TitanPL extensions, allowing you to test your code with the **real Rust native functions** instead of mocks.

## ✨ Features

- 🔍 **Auto-discovery** - Finds all TitanPL extensions (yours + dependencies)
- 🦀 **Real FFI** - Loads actual Rust DLLs via Koffi
- 📦 **Zero config** - Just add the setup file to Vitest
- 🔗 **Dependency aware** - Loads extensions in correct order
- 🎯 **Local priority** - Your extension takes precedence over node_modules

## 📦 Installation

```bash
npm install t8n-micro-gravity --save-dev
```

## 🚀 Quick Start

### 1. Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['t8n-micro-gravity/setup'],
    }
});
```

### 2. Write Tests

```typescript
// tests/my-extension.spec.ts
import { describe, it, expect } from 'vitest';

describe('My Extension', () => {
    
    it('uses real crypto from Rust', () => {
        // This calls the REAL crypto_hash from your DLL
        const hash = t.crypto.hash('sha256', 'titan');
        expect(hash).toHaveLength(64);
    });
    
    it('uses real localStorage', () => {
        t.ls.set('key', 'value');
        expect(t.ls.get('key')).toBe('value');
    });
    
    it('my custom extension works', () => {
        // Your extension's functions are available
        const result = t.myExtension.doSomething();
        expect(result).toBeDefined();
    });
});
```

### 3. Enable Debug Logging (Optional)

```bash
# See what extensions are being loaded
DEBUG=true npm test
# or
TITAN_DEBUG=true npm test
```

## 📁 How It Works

Micro-Gravity scans for TitanPL extensions by looking for `titan.json` files:

```
your-extension/              ← Your project
├── titan.json               ✓ Detected (local, highest priority)
├── native/target/release/
│   └── your_extension.dll   ← Loaded via FFI
├── index.js                 ← Loaded after native
└── node_modules/
    ├── @titanpl/core/
    │   └── titan.json       ✓ Detected (dependency)
    ├── some-titan-ext/
    │   └── titan.json       ✓ Detected (dependency)
    └── express/
        └── (no titan.json)  ✗ Ignored
```

### Load Order

1. Dependencies from `node_modules` (sorted by dependency graph)
2. Your local extension (loaded last, can use all dependencies)

### Duplicate Handling

If the same extension exists in multiple places, only the first one found is loaded (local project has priority).

## 🔧 Manual Bootstrap

If you need more control:

```typescript
import { bootstrap } from 't8n-micro-gravity';

await bootstrap({
    rootDir: '/path/to/project',  // Default: process.cwd()
    verbose: true,                 // Enable logging
    logger: console.log,           // Custom logger
});

// Now t and Titan are available globally
t.crypto.hash('sha256', 'hello');
```

## 📝 TypeScript Support

Add global types to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["t8n-micro-gravity/globals"]
  }
}
```

Then extend with your extension's types:

```typescript
// your-extension.d.ts
declare global {
    interface TitanRuntime {
        myExtension: {
            doSomething(): string;
            calculate(a: number, b: number): number;
        };
    }
}

export {};
```

## 🧪 API

### `bootstrap(options?)`

Initialize the sandbox. Called automatically if using the setup file.

```typescript
interface MicroGravityOptions {
    rootDir?: string;           // Project root (default: cwd)
    verbose?: boolean;          // Enable logging (default: false)
    logger?: (msg: string) => void;  // Custom logger
}
```

### `getLoadedExtensions(rootDir?)`

Get list of discovered extensions (useful for debugging).

```typescript
import { getLoadedExtensions } from 't8n-micro-gravity';

const extensions = getLoadedExtensions();
console.log(extensions);
// [
//   { name: '@titanpl/core', path: '...', isLocal: false },
//   { name: 'my-extension', path: '...', isLocal: true }
// ]
```

### `hasExtension(name)`

Check if an extension is loaded.

```typescript
import { hasExtension } from 't8n-micro-gravity';

if (hasExtension('@titanpl/core')) {
    // Core is available
}
```

## ⚠️ Requirements

- Node.js >= 18
- Vitest >= 1.0
- Your extension's native DLL must be compiled for your platform

## 🔍 Troubleshooting

### DLL not found

Make sure your `titan.json` has the correct path:

```json
{
  "name": "my-extension",
  "native": {
    "path": "native/target/release/my_extension.dll"
  }
}
```

The path can be:
- **Relative**: Resolved from your extension's directory
- **Absolute**: Used as-is

### Extension not loading

Run with debug to see what's happening:

```bash
TITAN_DEBUG=true npm test
```

### V8 serialize/deserialize

These functions use Node.js's built-in `v8` module, which is the same V8 engine used by TitanPL. They are fully compatible.

## 📄 License

ISC