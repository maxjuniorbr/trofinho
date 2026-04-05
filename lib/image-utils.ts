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

  // Render first to get original dimensions
  const probe = ImageManipulator.manipulate(uri);
  const probeRef = await probe.renderAsync();
  const { width, height } = probeRef;
  probeRef.release?.();

  const context = ImageManipulator.manipulate(uri);

  // Resize constraining the largest dimension
  if (width > maxDimension || height > maxDimension) {
    if (height > width) {
      context.resize({ height: maxDimension });
    } else {
      context.resize({ width: maxDimension });
    }
  }

  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    format: SaveFormat.JPEG,
    compress,
  });
  return result.uri;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;

export async function readImageAsArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  const normalizedUri = imageUri.split('?')[0] ?? imageUri;

  if (
    !normalizedUri.startsWith('http://') &&
    !normalizedUri.startsWith('https://')
  ) {
    try {
      const buffer = await new File(normalizedUri).arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('Imagem muito grande (máx. 10 MB)');
      }
      return buffer;
    } catch (err) {
      if (err instanceof Error && err.message.includes('muito grande')) throw err;
      // If local read fails, fall back to fetch.
    }
  }

  const fetchWithTimeout = (): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado ao carregar imagem')), FETCH_TIMEOUT_MS);
      fetch(imageUri)
        .then((res) => { clearTimeout(timer); resolve(res); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  };

  const response = await fetchWithTimeout();

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  const contentLength = Number(response.headers?.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error('Imagem muito grande (máx. 10 MB)');
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Imagem muito grande (máx. 10 MB)');
  }

  return buffer;
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