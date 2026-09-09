export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export type TaskAttachment = {
  id: string;
  taskId: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
};

export type QueuedAttachment = { id: string; file: File };

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentFileError(file: { name: string; size: number }) {
  let invalidName = !file.name.trim() || file.name.length > 240;
  for (const char of file.name) {
    if (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '/' || char === '\\') invalidName = true;
  }
  if (invalidName) return 'Choose a file with a name under 240 characters and no slashes or control characters.';
  if (file.size === 0) return `${file.name} is empty. Choose a file with content.`;
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is too large. Each file can be up to 10 MB.`;
  return null;
}
