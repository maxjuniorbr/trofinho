import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;

const DEFAULT_MAX_IMAGE_DIMENSION = 1024;
const DEFAULT_IMAGE_COMPRESS_QUALITY = 0.7;

export type ResizeImageOptions = Readonly<{
  maxDimension?: number;
  compress?: number;
}>;

export async function resizeImage(uri: string, options: ResizeImageOptions = {}): Promise<string> {
  const { maxDimension = DEFAULT_MAX_IMAGE_DIMENSION, compress = DEFAULT_IMAGE_COMPRESS_QUALITY } =
    options;

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
const SIZE_ERROR = 'Imagem muito grande (máx. 10 MB)';

function assertImageSize(buffer: ArrayBuffer): void {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(SIZE_ERROR);
  }
}

function isLocalUri(uri: string): boolean {
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

async function readLocalImage(uri: string): Promise<ArrayBuffer | null> {
  try {
    const buffer = await new File(uri).arrayBuffer();
    assertImageSize(buffer);
    return buffer;
  } catch (err) {
    if (err instanceof Error && err.message === SIZE_ERROR) throw err;
    return null;
  }
}

async function fetchImageWithTimeout(uri: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(uri, { signal: controller.signal as RequestInit['signal'] });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Tempo esgotado ao carregar imagem');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readBufferStreaming(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error(SIZE_ERROR);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

export async function readImageAsArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  const normalizedUri = imageUri.split('?')[0] ?? imageUri;

  if (isLocalUri(normalizedUri)) {
    const localBuffer = await readLocalImage(normalizedUri);
    if (localBuffer) return localBuffer;
  }

  const response = await fetchImageWithTimeout(imageUri);

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada');
  }

  const contentLength = Number(response.headers?.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error(SIZE_ERROR);
  }

  // Try streaming read so we can abort early if the body exceeds the cap even
  // when the server omits a content-length header. Falls back to arrayBuffer()
  // when the response has no readable stream (e.g. RN polyfills, mocks).
  const stream = (response as unknown as { body?: ReadableStream<Uint8Array> | null }).body;
  if (stream) {
    return readBufferStreaming(stream);
  }

  const buffer = await response.arrayBuffer();
  assertImageSize(buffer);

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
