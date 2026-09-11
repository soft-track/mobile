import { AXIOS_INSTANCE } from '@/api/client';
import type { AttachmentRead } from '@/api/generated/models';
import { contentTypeFor } from '@/attachments/rules';

/**
 * Uploading a file the API expects as multipart.
 *
 * Not routed through the generated client: Orval emits a `Blob` body for the
 * upload, and React Native has no real Blob to give it -- a file is a `file://`
 * URI that the native networking layer streams itself. Handing axios a
 * `FormData` with `{uri, name, type}` is how that is expressed, and it also
 * gives a progress callback, which reading the whole file into memory first
 * would not.
 */
export type UploadProgress = (fraction: number) => void;

export async function uploadAttachment({
  issueId,
  uri,
  filename,
  onProgress,
  signal,
}: {
  issueId: number;
  uri: string;
  filename: string;
  onProgress?: UploadProgress;
  signal?: AbortSignal;
}): Promise<AttachmentRead> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: filename,
    // The server derives the type from the extension anyway, but sending the
    // right one avoids a generic octet-stream round trip.
    type: contentTypeFor(filename) ?? 'application/octet-stream',
  } as unknown as Blob);

  const { data } = await AXIOS_INSTANCE.post<AttachmentRead>(
    `/issues/${issueId}/attachments`,
    form,
    {
      signal,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return;
        // `total` is absent on some platforms; an indeterminate bar is better
        // than a bar that jumps to 100% and sits there.
        if (event.total) onProgress(Math.min(1, event.loaded / event.total));
      },
    },
  );
  return data;
}

/**
 * A filename for something the picker gave no name to.
 *
 * The camera hands back a `file://.../ABC123.jpg` with no display name, and the
 * extension is what the server validates on, so it has to survive.
 */
export function filenameFrom(uri: string, fallbackExtension = '.jpg'): string {
  const withoutQuery = uri.split('?')[0];
  const last = withoutQuery.split('/').pop() ?? '';
  if (last.includes('.')) return decodeURIComponent(last);
  return `upload-${Date.now()}${fallbackExtension}`;
}
