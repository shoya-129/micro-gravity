import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/setup.ts'],
        include: ['tests/**/*.spec.ts'],
        testTimeout: 30000,
        typecheck: {
            tsconfig: './tsconfig.test.json',
        },
    },
});