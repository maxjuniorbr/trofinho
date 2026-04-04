import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

vi.mock('expo-file-system', () => ({
  File: vi.fn(),
}));

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

import { inferImageExtension, inferImageContentType, extractErrorMessage, resizeImage, readImageAsArrayBuffer } from './image-utils';
import { ImageManipulator } from 'expo-image-manipulator';

describe('resizeImage', () => {
  it('resizes when at least one dimension exceeds maxDimension', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///resized.jpg' });
    const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
    const resize = vi.fn().mockReturnValue(undefined);

    const probeRenderAsync = vi.fn().mockResolvedValue({ width: 2000, height: 1500 });

    vi.mocked(ImageManipulator.manipulate)
      .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
      .mockReturnValueOnce({ resize, renderAsync: mainRenderAsync } as any);

    const result = await resizeImage('file:///photo.jpg');

    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(2);
    expect(resize).toHaveBeenCalledWith({ width: 1024 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
    expect(result).toBe('file:///resized.jpg');
  });

  it('skips resize when both dimensions are within maxDimension', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///compressed.jpg' });
    const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
    const resize = vi.fn().mockReturnValue(undefined);

    const probeRenderAsync = vi.fn().mockResolvedValue({ width: 800, height: 600 });

    vi.mocked(ImageManipulator.manipulate)
      .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
      .mockReturnValueOnce({ resize, renderAsync: mainRenderAsync } as any);

    const result = await resizeImage('file:///photo.jpg');

    expect(resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
    expect(result).toBe('file:///compressed.jpg');
  });

  it('uses custom options when provided', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///resized.jpg' });
    const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
    const resize = vi.fn().mockReturnValue(undefined);

    const probeRenderAsync = vi.fn().mockResolvedValue({ width: 2000, height: 1500 });

    vi.mocked(ImageManipulator.manipulate)
      .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
      .mockReturnValueOnce({ resize, renderAsync: mainRenderAsync } as any);

    await resizeImage('file:///photo.jpg', { maxDimension: 512, compress: 0.5 });

    expect(resize).toHaveBeenCalledWith({ width: 512 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.5 });
  });

  it('resizes when only height exceeds maxDimension', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///resized.jpg' });
    const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
    const resize = vi.fn().mockReturnValue(undefined);

    const probeRenderAsync = vi.fn().mockResolvedValue({ width: 500, height: 2000 });

    vi.mocked(ImageManipulator.manipulate)
      .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
      .mockReturnValueOnce({ resize, renderAsync: mainRenderAsync } as any);

    await resizeImage('file:///photo.jpg');

    expect(resize).toHaveBeenCalledWith({ height: 1024 });
  });

  it('skips resize when dimensions exactly equal maxDimension', async () => {
    const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///compressed.jpg' });
    const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
    const resize = vi.fn().mockReturnValue(undefined);

    const probeRenderAsync = vi.fn().mockResolvedValue({ width: 1024, height: 1024 });

    vi.mocked(ImageManipulator.manipulate)
      .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
      .mockReturnValueOnce({ resize, renderAsync: mainRenderAsync } as any);

    await resizeImage('file:///photo.jpg');

    expect(resize).not.toHaveBeenCalled();
  });
});

describe('inferImageExtension', () => {
  it('retorna a extensão de uma URI com extensão conhecida', () => {
    expect(inferImageExtension('file:///photo.png')).toBe('png');
    expect(inferImageExtension('file:///photo.jpg')).toBe('jpg');
    expect(inferImageExtension('file:///photo.jpeg')).toBe('jpeg');
    expect(inferImageExtension('file:///photo.webp')).toBe('webp');
    expect(inferImageExtension('file:///photo.heic')).toBe('heic');
    expect(inferImageExtension('file:///photo.heif')).toBe('heif');
  });

  it('ignora query string ao extrair extensão', () => {
    expect(inferImageExtension('https://cdn.example.com/photo.png?token=abc')).toBe('png');
  });

  it('retorna jpg para extensão desconhecida', () => {
    expect(inferImageExtension('file:///photo.bmp')).toBe('jpg');
    expect(inferImageExtension('file:///photo.tiff')).toBe('jpg');
  });

  it('retorna jpg para URI sem extensão', () => {
    expect(inferImageExtension('https://example.com/image')).toBe('jpg');
  });

  it('trata extensão case-insensitive', () => {
    expect(inferImageExtension('file:///photo.PNG')).toBe('png');
    expect(inferImageExtension('file:///photo.WEBP')).toBe('webp');
  });
});

describe('inferImageContentType', () => {
  it('retorna content type correto para extensões conhecidas', () => {
    expect(inferImageContentType('png')).toBe('image/png');
    expect(inferImageContentType('webp')).toBe('image/webp');
    expect(inferImageContentType('heic')).toBe('image/heic');
    expect(inferImageContentType('heif')).toBe('image/heif');
  });

  it('retorna image/jpeg como fallback', () => {
    expect(inferImageContentType('jpg')).toBe('image/jpeg');
    expect(inferImageContentType('jpeg')).toBe('image/jpeg');
    expect(inferImageContentType('unknown')).toBe('image/jpeg');
  });
});

describe('extractErrorMessage', () => {
  it('retorna mensagem de Error padrão', () => {
    expect(extractErrorMessage(new Error('falha na rede'), 'fallback')).toBe('falha na rede');
  });

  it('retorna mensagem de objeto com propriedade message', () => {
    expect(extractErrorMessage({ message: 'erro do servidor' }, 'fallback')).toBe('erro do servidor');
  });

  it('retorna fallback para Error com mensagem vazia', () => {
    expect(extractErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
    expect(extractErrorMessage(new Error(''), 'fallback')).toBe('fallback'); // NOSONAR typescript:S7722 — intentionally testing empty-message Error
  });

  it('retorna fallback para objeto com message vazia', () => {
    expect(extractErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
    expect(extractErrorMessage({ message: '  ' }, 'fallback')).toBe('fallback');
  });

  it('retorna fallback para tipos primitivos', () => {
    expect(extractErrorMessage('string error', 'fallback')).toBe('fallback');
    expect(extractErrorMessage(42, 'fallback')).toBe('fallback');
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('retorna fallback para objeto sem message', () => {
    expect(extractErrorMessage({ code: 500 }, 'fallback')).toBe('fallback');
  });

  it('retorna fallback para objeto com message não-string', () => {
    expect(extractErrorMessage({ message: 123 }, 'fallback')).toBe('fallback');
  });
});

describe('readImageAsArrayBuffer', () => {
  it('rejects remote files exceeding 10 MB via content-length', async () => {
    const mockResponse = {
      ok: true,
      headers: { get: (h: string) => h === 'content-length' ? '20000000' : null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(readImageAsArrayBuffer('https://example.com/huge.jpg'))
      .rejects.toThrow('muito grande');

    vi.unstubAllGlobals();
  });

  it('rejects remote files exceeding 10 MB via actual buffer size', async () => {
    const hugeBuffer = new ArrayBuffer(11 * 1024 * 1024);
    const mockResponse = {
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve(hugeBuffer),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(readImageAsArrayBuffer('https://example.com/huge.jpg'))
      .rejects.toThrow('muito grande');

    vi.unstubAllGlobals();
  });
});

describe('property tests', () => {
  // Feature: review-phases-1-2-implementation, Property 5: Image resize decision based on dimensions
  // **Validates: Requirements 18.1, 18.2**
  it('P5: resize() is called iff at least one dimension exceeds maxDimension', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 100, max: 2000 }),
        async (width, height, maxDimension) => {
          vi.mocked(ImageManipulator.manipulate).mockReset();

          const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///result.jpg' });
          const mainRenderAsync = vi.fn().mockResolvedValue({ saveAsync });
          const resize = vi.fn();
          const probeRenderAsync = vi.fn().mockResolvedValue({ width, height });

          const mainContext = { resize, renderAsync: mainRenderAsync };
          vi.mocked(ImageManipulator.manipulate)
            .mockReturnValueOnce({ renderAsync: probeRenderAsync } as any)
            .mockReturnValueOnce(mainContext as any);

          await resizeImage('file:///test.jpg', { maxDimension });

          const shouldResize = width > maxDimension || height > maxDimension;
          if (shouldResize) {
            if (height > width) {
              expect(resize).toHaveBeenCalledWith({ height: maxDimension });
            } else {
              expect(resize).toHaveBeenCalledWith({ width: maxDimension });
            }
          } else {
            expect(resize).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
