import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: vi.fn(),
}));

vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: vi.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

import { inferImageExtension, inferImageContentType, extractErrorMessage } from './image-utils';

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
    expect(extractErrorMessage(new Error(''), 'fallback')).toBe('fallback');
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
