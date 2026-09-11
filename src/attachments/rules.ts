/**
 * What the server will accept, mirrored so a phone can say no before spending
 * a minute uploading something that was never going to land.
 *
 * Kept in sync by hand with `backend/lib_softtrack/attachments.py` -- the
 * allowed list is not in the OpenAPI schema, so there is nothing to generate
 * it from.
 */

/** `.svg` is deliberately absent: it is a document that can carry script. */
export const ALLOWED_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.patch': 'text/plain',
  '.diff': 'text/plain',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/** The default cap; an instance can lower it, and the server has final say. */
export const MAX_BYTES = 25 * 1024 * 1024;

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function contentTypeFor(filename: string): string | null {
  return ALLOWED_TYPES[extensionOf(filename)] ?? null;
}

export type Rejection = { reason: 'type' | 'size'; message: string };

/**
 * Why this file cannot be uploaded, or `null` if it can.
 *
 * Names the file rather than stating a rule in the abstract, because the person
 * picking it is looking at a gallery of a hundred things.
 */
export function rejectionFor(
  filename: string,
  sizeBytes: number | undefined,
  maxBytes = MAX_BYTES,
): Rejection | null {
  if (contentTypeFor(filename) === null) {
    const extension = extensionOf(filename);
    return {
      reason: 'type',
      message:
        extension === '.svg'
          ? 'SVG files are not accepted, because they can carry script.'
          : `${extension || 'That file type'} is not accepted. Try an image, PDF, text, CSV, JSON, zip or video file.`,
    };
  }

  if (sizeBytes !== undefined && sizeBytes > maxBytes) {
    return {
      reason: 'size',
      message: `${filename} is ${formatBytes(sizeBytes)}, over the ${formatBytes(maxBytes)} limit.`,
    };
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
