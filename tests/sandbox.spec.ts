/**
 * Example test file
 * 
 * This demonstrates how tests would look when using micro-gravity
 * with a real TitanPL extension.
 */

/// <reference path="../src/globals.d.ts" />

import { describe, it, expect } from 'vitest';
import { getLoadedExtensions } from '../src/index.js';

describe('MicroGravity Sandbox', () => {
    
    describe('Discovery', () => {
        it('should discover extensions', () => {
            const extensions = getLoadedExtensions();
            // In a real project, this would find titan.json files
            expect(Array.isArray(extensions)).toBe(true);
        });
    });

    describe('Global t object', () => {
        it('should have t globally available', () => {
            expect(t).toBeDefined();
        });

        it('should have Titan as alias', () => {
            expect(Titan).toBe(t);
        });

        it('should have log function', () => {
            expect(typeof t.log).toBe('function');
        });
    });
});

/**
 * Example tests with @titanpl/core (when installed):
 * 
 * describe('With @titanpl/core', () => {
 *     it('crypto.hash works', () => {
 *         const hash = t.crypto.hash('sha256', 'test');
 *         expect(hash).toHaveLength(64);
 *     });
 * 
 *     it('ls (localStorage) works', () => {
 *         t.ls.set('key', 'value');
 *         expect(t.ls.get('key')).toBe('value');
 *         t.ls.remove('key');
 *     });
 * });
 */