import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { queryFnAdapter, nullableQueryFnAdapter, mutationFnAdapter } from '../query-fn-adapter';

describe('queryFnAdapter', () => {
  // Feature: react-query-migration, Property 2: queryFnAdapter success/error contract
  describe('Property 2: queryFnAdapter success/error contract', () => {
    it('returns data when error is null and data is non-null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.anything().filter((v) => v != null),
          async (data) => {
            const adapter = queryFnAdapter(() => Promise.resolve({ data, error: null }));
            const result = await adapter();
            expect(result).toBe(data);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws Error with the error message when error is a non-null string', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (errorMsg) => {
            const adapter = queryFnAdapter(() =>
              Promise.resolve({ data: null, error: errorMsg }),
            );
            await expect(adapter()).rejects.toThrow(errorMsg);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws "Registro não encontrado." when error is null and data is null', async () => {
      const adapter = queryFnAdapter(() =>
        Promise.resolve({ data: null, error: null }),
      );
      await expect(adapter()).rejects.toThrow('Registro não encontrado.');
    });

    it('throws "Registro não encontrado." when error is null and data is undefined', async () => {
      const adapter = queryFnAdapter(() =>
        Promise.resolve({ data: undefined, error: null }),
      );
      await expect(adapter()).rejects.toThrow('Registro não encontrado.');
    });

    it('error takes precedence over non-null data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.anything().filter((v) => v != null),
          async (errorMsg, data) => {
            const adapter = queryFnAdapter(() =>
              Promise.resolve({ data, error: errorMsg }),
            );
            await expect(adapter()).rejects.toThrow(errorMsg);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

describe('nullableQueryFnAdapter', () => {
  it('returns data when error is null and data is non-null', async () => {
    const adapter = nullableQueryFnAdapter(() => Promise.resolve({ data: { id: 1 }, error: null }));
    await expect(adapter()).resolves.toEqual({ id: 1 });
  });

  it('returns null when error is null and data is null', async () => {
    const adapter = nullableQueryFnAdapter(() => Promise.resolve({ data: null, error: null }));
    await expect(adapter()).resolves.toBeNull();
  });

  it('throws when error is non-null', async () => {
    const adapter = nullableQueryFnAdapter(() => Promise.resolve({ data: null, error: 'falhou' }));
    await expect(adapter()).rejects.toThrow('falhou');
  });
});

describe('mutationFnAdapter', () => {
  it('resolves when error is null', async () => {
    const adapter = mutationFnAdapter(() => Promise.resolve({ error: null }));
    await expect(adapter()).resolves.toBeUndefined();
  });

  it('throws Error with the error message when error is a non-null string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMsg) => {
          const adapter = mutationFnAdapter(() =>
            Promise.resolve({ error: errorMsg }),
          );
          await expect(adapter()).rejects.toThrow(errorMsg);
        },
      ),
      { numRuns: 100 },
    );
  });
});
