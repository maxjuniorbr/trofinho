import { extractErrorMessage } from './api-error';
import {
  inferImageContentType,
  inferImageExtension,
  readImageAsArrayBuffer,
  resizeImage,
  type ResizeImageOptions,
} from './image-utils';
import { supabase } from './supabase';

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

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
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
