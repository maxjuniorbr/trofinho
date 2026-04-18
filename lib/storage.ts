import { extractErrorMessage } from './api-error';
import {
  inferImageContentType,
  inferImageExtension,
  readImageAsArrayBuffer,
  resizeImage,
  type ResizeImageOptions,
} from './image-utils';
import { supabase } from './supabase';

/** Signed URLs expire after 1 hour — long enough for a session, short enough for privacy. */
const SIGNED_URL_EXPIRY_S = 3600;

export type PreparedImageUpload = Readonly<{
  buffer: ArrayBuffer;
  contentType: string;
  extension: string;
}>;

type UploadImageToPublicBucketInput = Readonly<{
  bucket: string;
  imageUri: string;
  pathWithoutExtension: string;
  imageOptions?: ResizeImageOptions;
  upsert?: boolean;
}>;

type UploadImageToPublicBucketResult = Readonly<{
  error: string | null;
  path: string | null;
  publicUrl: string | null;
}>;

export async function prepareImageUpload(
  imageUri: string,
  imageOptions?: ResizeImageOptions,
): Promise<PreparedImageUpload> {
  const resizedUri = await resizeImage(imageUri, imageOptions);
  const extension = inferImageExtension(resizedUri);

  return {
    buffer: await readImageAsArrayBuffer(resizedUri),
    contentType: inferImageContentType(extension),
    extension,
  };
}

export async function uploadImageToPublicBucket({
  bucket,
  imageUri,
  imageOptions,
  pathWithoutExtension,
  upsert = true,
}: UploadImageToPublicBucketInput): Promise<UploadImageToPublicBucketResult> {
  try {
    const { buffer, contentType, extension } = await prepareImageUpload(imageUri, imageOptions);
    const path = `${pathWithoutExtension}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert,
    });

    if (uploadError) {
      return {
        error: uploadError.message,
        path: null,
        publicUrl: null,
      };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      error: null,
      path,
      publicUrl: `${data.publicUrl}?t=${Date.now()}`,
    };
  } catch (error) {
    return {
      error: extractErrorMessage(error, 'Erro ao fazer upload da imagem'),
      path: null,
      publicUrl: null,
    };
  }
}

/**
 * Extracts the storage path from a stored value.
 * Handles both full Supabase public URLs and raw paths.
 */
function extractStoragePath(bucket: string, storedValue: string): string {
  try {
    const url = new URL(storedValue);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    const idx = url.pathname.indexOf(prefix);
    if (idx >= 0) {
      return decodeURIComponent(url.pathname.substring(idx + prefix.length));
    }
  } catch {
    // Not a valid URL — treat as raw path
  }
  return storedValue;
}

/**
 * Detects non-path values (e.g. emoji avatars) stored directly in avatar_url.
 * Storage paths always contain '/' or end with an image extension.
 */
export function isEmojiAvatar(value: string): boolean {
  return !value.includes('/') && !/\.[a-z]{2,5}$/i.test(value) && !value.startsWith('http');
}

/**
 * Converts a stored avatar/image reference (public URL or raw path) into a
 * short-lived signed URL for private bucket access.
 */
export async function resolveStorageUrl(
  bucket: string,
  storedValue: string | null | undefined,
): Promise<string | null> {
  if (!storedValue) return null;
  if (isEmojiAvatar(storedValue)) return storedValue;

  const path = extractStoragePath(bucket, storedValue);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_S);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Batch-resolves multiple stored references into signed URLs in a single API call.
 * Maintains index alignment: result[i] corresponds to storedValues[i].
 */
export async function resolveStorageUrls(
  bucket: string,
  storedValues: (string | null | undefined)[],
): Promise<(string | null)[]> {
  // Separate emoji avatars (pass-through) from storage paths (need signing)
  const results: (string | null)[] = storedValues.map(() => null);
  const pathIndices: number[] = [];
  const pathValues: string[] = [];

  storedValues.forEach((v, i) => {
    if (!v) return;
    if (isEmojiAvatar(v)) {
      results[i] = v;
    } else {
      pathIndices.push(i);
      pathValues.push(extractStoragePath(bucket, v));
    }
  });

  if (pathValues.length === 0) return results;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(pathValues, SIGNED_URL_EXPIRY_S);

  if (error || !data) return results;

  pathIndices.forEach((origIdx, dataIdx) => {
    results[origIdx] = data[dataIdx]?.signedUrl ?? null;
  });

  return results;
}
