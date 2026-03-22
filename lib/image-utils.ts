import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;

const DEFAULT_MAX_IMAGE_DIMENSION = 1024;
const DEFAULT_IMAGE_COMPRESS_QUALITY = 0.7;

export type ResizeImageOptions = Readonly<{
  maxDimension?: number;
  compress?: number;
}>;

export async function resizeImage(
  uri: string,
  options: ResizeImageOptions = {},
): Promise<string> {
  const {
    maxDimension = DEFAULT_MAX_IMAGE_DIMENSION,
    compress = DEFAULT_IMAGE_COMPRESS_QUALITY,
  } = options;
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxDimension });
  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress,
  });
  return result.uri;
}

export async function readImageAsArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  const normalizedUri = imageUri.split('?')[0] ?? imageUri;

  if (
    !normalizedUri.startsWith('http://') &&
    !normalizedUri.startsWith('https://')
  ) {
    try {
      return await new File(normalizedUri).arrayBuffer();
    } catch {
      // If local read fails, fall back to fetch.
    }
  }

  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  return response.arrayBuffer();
}

export function inferImageExtension(imageUri: string): string {
  const extension = imageUri.split('?')[0]?.split('.').pop()?.toLowerCase();

  if (SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    return extension!;
  }

  return 'jpg';
}

export function inferImageContentType(extension: string): string {
  const map: Record<string, string> = {
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };

  return map[extension] ?? 'image/jpeg';
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}
