import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import {
  isEmojiAvatar,
  prepareImageUpload,
  resolveStorageUrl,
  resolveStorageUrls,
  uploadImageToBucket,
} from './storage';

const resizeImageMock = vi.hoisted(() => vi.fn((uri: string) => Promise.resolve(uri)));
const readImageAsArrayBufferMock = vi.hoisted(() => vi.fn());
const inferImageExtensionMock = vi.hoisted(() => vi.fn());
const inferImageContentTypeMock = vi.hoisted(() => vi.fn());

vi.mock('./image-utils', () => ({
  resizeImage: resizeImageMock,
  readImageAsArrayBuffer: readImageAsArrayBufferMock,
  inferImageExtension: inferImageExtensionMock,
  inferImageContentType: inferImageContentTypeMock,
}));

vi.mock('./api-error', () => ({
  extractErrorMessage: (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
  },
}));

const storageBucketMock = vi.hoisted(() => ({
  upload: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  storage: { from: vi.fn() },
}));

vi.mock('./supabase', () => ({
  supabase: supabaseMock,
}));

describe('storage', () => {
  beforeEach(() => {
    resizeImageMock.mockReset().mockImplementation((uri: string) => Promise.resolve(uri));
    readImageAsArrayBufferMock.mockReset();
    inferImageExtensionMock.mockReset();
    inferImageContentTypeMock.mockReset();
    storageBucketMock.upload.mockReset();
    supabaseMock.storage.from.mockReset().mockReturnValue(storageBucketMock);
  });

  describe('prepareImageUpload', () => {
    it('resizes, reads buffer, and infers content type', async () => {
      const buffer = new ArrayBuffer(8);
      resizeImageMock.mockResolvedValue('file:///resized.jpg');
      readImageAsArrayBufferMock.mockResolvedValue(buffer);
      inferImageExtensionMock.mockReturnValue('jpg');
      inferImageContentTypeMock.mockReturnValue('image/jpeg');

      const result = await prepareImageUpload('file:///photo.jpg');

      expect(resizeImageMock).toHaveBeenCalledWith('file:///photo.jpg', undefined);
      expect(inferImageExtensionMock).toHaveBeenCalledWith('file:///resized.jpg');
      expect(readImageAsArrayBufferMock).toHaveBeenCalledWith('file:///resized.jpg');
      expect(inferImageContentTypeMock).toHaveBeenCalledWith('jpg');
      expect(result).toEqual({ buffer, contentType: 'image/jpeg', extension: 'jpg' });
    });

    it('passes resize options through', async () => {
      readImageAsArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
      inferImageExtensionMock.mockReturnValue('png');
      inferImageContentTypeMock.mockReturnValue('image/png');

      await prepareImageUpload('file:///photo.png', { maxDimension: 512, compress: 0.5 });

      expect(resizeImageMock).toHaveBeenCalledWith('file:///photo.png', {
        maxDimension: 512,
        compress: 0.5,
      });
    });
  });

  describe('uploadImageToBucket', () => {
    const setupMocks = (ext = 'jpg', contentType = 'image/jpeg') => {
      const buffer = new ArrayBuffer(8);
      readImageAsArrayBufferMock.mockResolvedValue(buffer);
      inferImageExtensionMock.mockReturnValue(ext);
      inferImageContentTypeMock.mockReturnValue(contentType);
      return buffer;
    };

    it('uploads to the correct path with upsert true by default', async () => {
      const buffer = setupMocks();
      storageBucketMock.upload.mockResolvedValue({ error: null });

      const result = await uploadImageToBucket({
        bucket: 'premios',
        imageUri: 'file:///photo.jpg',
        pathWithoutExtension: 'img/capa',
      });

      expect(supabaseMock.storage.from).toHaveBeenCalledWith('premios');
      expect(storageBucketMock.upload).toHaveBeenCalledWith('img/capa.jpg', buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      expect(result).toEqual({
        error: null,
        path: 'img/capa.jpg',
      });
    });

    it('respects upsert: false', async () => {
      setupMocks();
      storageBucketMock.upload.mockResolvedValue({ error: null });

      await uploadImageToBucket({
        bucket: 'premios',
        imageUri: 'file:///photo.jpg',
        pathWithoutExtension: 'img',
        upsert: false,
      });

      expect(storageBucketMock.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(ArrayBuffer),
        expect.objectContaining({ upsert: false }),
      );
    });

    it('returns upload error', async () => {
      setupMocks();
      storageBucketMock.upload.mockResolvedValue({
        error: { message: 'Storage quota exceeded' },
      });

      const result = await uploadImageToBucket({
        bucket: 'premios',
        imageUri: 'file:///photo.jpg',
        pathWithoutExtension: 'img/capa',
      });

      expect(result).toEqual({
        error: 'Storage quota exceeded',
        path: null,
      });
    });

    it('returns fallback error when prepareImageUpload throws', async () => {
      resizeImageMock.mockRejectedValue(new Error('resize failed'));

      const result = await uploadImageToBucket({
        bucket: 'premios',
        imageUri: 'file:///photo.jpg',
        pathWithoutExtension: 'img/capa',
      });

      expect(result).toEqual({
        error: 'resize failed',
        path: null,
      });
    });

    it('returns generic fallback for non-Error throws', async () => {
      resizeImageMock.mockRejectedValue({ code: 'UNKNOWN' });

      const result = await uploadImageToBucket({
        bucket: 'premios',
        imageUri: 'file:///photo.jpg',
        pathWithoutExtension: 'img/capa',
      });

      expect(result).toEqual({
        error: 'Erro ao fazer upload da imagem',
        path: null,
      });
    });
  });

  describe('property tests', () => {
    it('upload path is always {pathWithoutExtension}.{extension}', async () => {
      const extArb = fc.constantFrom('jpg', 'png', 'webp', 'heic');
      const pathArb = fc.stringMatching(/^[a-z0-9/._-]{1,50}$/);

      await fc.assert(
        fc.asyncProperty(pathArb, extArb, async (basePath, ext) => {
          readImageAsArrayBufferMock.mockReset();
          inferImageExtensionMock.mockReset();
          inferImageContentTypeMock.mockReset();
          storageBucketMock.upload.mockReset();
          supabaseMock.storage.from.mockReset().mockReturnValue(storageBucketMock);
          resizeImageMock.mockReset().mockImplementation((uri: string) => Promise.resolve(uri));

          readImageAsArrayBufferMock.mockResolvedValue(new ArrayBuffer(4));
          inferImageExtensionMock.mockReturnValue(ext);
          inferImageContentTypeMock.mockReturnValue('image/jpeg');
          storageBucketMock.upload.mockResolvedValue({ error: null });

          const result = await uploadImageToBucket({
            bucket: 'test',
            imageUri: `file:///photo.${ext}`,
            pathWithoutExtension: basePath,
          });

          expect(result.path).toBe(`${basePath}.${ext}`);
          expect(storageBucketMock.upload).toHaveBeenCalledWith(
            `${basePath}.${ext}`,
            expect.any(ArrayBuffer),
            expect.any(Object),
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('isEmojiAvatar', () => {
    it.each([
      ['🧒🏻', true],
      ['👦🏽', true],
      ['avatars/abc.jpg', false],
      ['photo.png', false],
      ['https://example.com/img.jpg', false],
      ['nested/folder/file.webp', false],
    ])('returns %s for value "%s"', (value, expected) => {
      expect(isEmojiAvatar(value)).toBe(expected);
    });
  });

  describe('resolveStorageUrl', () => {
    const createSignedUrlMock = vi.fn();

    beforeEach(() => {
      createSignedUrlMock.mockReset();
      supabaseMock.storage.from
        .mockReset()
        .mockReturnValue({ createSignedUrl: createSignedUrlMock });
    });

    it('returns null for null/empty values', async () => {
      await expect(resolveStorageUrl('avatars', null)).resolves.toBeNull();
      await expect(resolveStorageUrl('avatars', undefined)).resolves.toBeNull();
      await expect(resolveStorageUrl('avatars', '')).resolves.toBeNull();
    });

    it('passes emoji avatars through without signing', async () => {
      await expect(resolveStorageUrl('avatars', '🧒🏻')).resolves.toBe('🧒🏻');
      expect(createSignedUrlMock).not.toHaveBeenCalled();
    });

    it('signs storage paths', async () => {
      createSignedUrlMock.mockResolvedValue({
        data: { signedUrl: 'https://signed.example.com/x.jpg' },
        error: null,
      });
      await expect(resolveStorageUrl('avatars', 'user/abc.jpg')).resolves.toBe(
        'https://signed.example.com/x.jpg',
      );
    });

    it('returns null when signing fails', async () => {
      createSignedUrlMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
      await expect(resolveStorageUrl('avatars', 'user/abc.jpg')).resolves.toBeNull();
    });
  });

  describe('resolveStorageUrls', () => {
    const createSignedUrlsMock = vi.fn();

    beforeEach(() => {
      createSignedUrlsMock.mockReset();
      supabaseMock.storage.from
        .mockReset()
        .mockReturnValue({ createSignedUrls: createSignedUrlsMock });
    });

    it('returns array of nulls when all values are nullish', async () => {
      const result = await resolveStorageUrls('avatars', [null, undefined, '']);
      expect(result).toEqual([null, null, null]);
      expect(createSignedUrlsMock).not.toHaveBeenCalled();
    });

    it('mixes emoji passthrough with signed paths preserving order', async () => {
      createSignedUrlsMock.mockResolvedValue({
        data: [
          { signedUrl: 'https://signed.example.com/a.jpg' },
          { signedUrl: 'https://signed.example.com/b.jpg' },
        ],
        error: null,
      });

      const result = await resolveStorageUrls('avatars', [
        'user1/a.jpg',
        '🧒🏻',
        null,
        'user2/b.jpg',
      ]);

      expect(result).toEqual([
        'https://signed.example.com/a.jpg',
        '🧒🏻',
        null,
        'https://signed.example.com/b.jpg',
      ]);
      expect(createSignedUrlsMock).toHaveBeenCalledWith(
        ['user1/a.jpg', 'user2/b.jpg'],
        expect.any(Number),
      );
    });

    it('returns nulls for path entries when signing fails (emoji still passes through)', async () => {
      createSignedUrlsMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
      const result = await resolveStorageUrls('avatars', ['user/a.jpg', '🧒🏻']);
      expect(result).toEqual([null, '🧒🏻']);
    });
  });
});
