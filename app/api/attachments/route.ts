import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAttachmentBucket, getRawDb } from '@/db';
import { attachmentFileError, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, type TaskAttachment } from '@/lib/attachments';
import { attachmentColumns, privateJson as json, sameOrigin } from '@/lib/attachment-server';

export const dynamic = 'force-dynamic';

// Bound the actual body, including requests with absent or dishonest size headers.
async function readFile(request: Request, size: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('The file is missing. Please choose it again.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > size || total > MAX_ATTACHMENT_BYTES) {
        await reader.cancel();
        throw new Error('The file size changed. Please choose the file again.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (total !== size) throw new Error('The upload was incomplete. Please try again.');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in again to upload files.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  const taskId = new URL(request.url).searchParams.get('taskId');
  const id = request.headers.get('x-attachment-id') || '';
  if (!taskId || taskId.length > 100 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({ error: 'Choose the action and file again.' }, 400);
  let name: string;
  try { name = decodeURIComponent(request.headers.get('x-file-name') || ''); }
  catch { return json({ error: 'Please choose a file with a valid name.' }, 400); }
  const size = Number(request.headers.get('x-file-size'));
  const fileError = attachmentFileError({ name, size });
  if (fileError) return json({ error: fileError }, size > MAX_ATTACHMENT_BYTES ? 413 : 400);
  if (Number(request.headers.get('content-length')) > MAX_ATTACHMENT_BYTES) return json({ error: 'Each file can be up to 10 MB.' }, 413);
  const requestedType = request.headers.get('content-type') || '';
  const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(requestedType) && requestedType.length <= 120 ? requestedType : 'application/octet-stream';
  try {
    const db = getRawDb();
    const parent = await db.prepare('SELECT id FROM tasks WHERE id = ? AND owner = ? AND deleted = 0').bind(taskId, user.userId).first();
    if (!parent) return json({ error: 'This action is unavailable. Refresh your workspace.' }, 404);
    // Stable client-generated IDs make retries safe after a lost response.
    const existing = await db.prepare(`SELECT ${attachmentColumns} FROM attachments a WHERE a.id = ? AND a.owner = ? AND a.task_id = ?`).bind(id, user.userId, taskId).first<TaskAttachment>();
    if (existing) return json({ attachment: existing });
    const count = await db.prepare('SELECT COUNT(*) AS count FROM attachments WHERE owner = ? AND task_id = ?').bind(user.userId, taskId).first<{ count: number }>();
    if ((count?.count ?? 0) >= MAX_ATTACHMENTS) return json({ error: 'Each action can hold up to 10 files. Remove one before adding another.' }, 409);
    let bytes: Uint8Array;
    try { bytes = await readFile(request, size); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Could not read this file.' }, 400); }
    // Each attempt gets a distinct key so competing retries cannot overwrite a saved file.
    const objectKey = `attachments/${crypto.randomUUID()}`;
    const bucket = getAttachmentBucket();
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
    const attachment: TaskAttachment = { id, taskId, name, size, contentType, createdAt: new Date().toISOString() };
    let inserted;
    try {
      // Check parent and capacity again atomically after the upload finishes.
      inserted = await db.prepare(`INSERT INTO attachments (id, task_id, owner, object_key, name, size, content_type, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM tasks WHERE id = ? AND owner = ? AND deleted = 0)
        AND (SELECT COUNT(*) FROM attachments WHERE owner = ? AND task_id = ?) < ?
        ON CONFLICT(id) DO NOTHING`).bind(id, taskId, user.userId, objectKey, name, size, contentType, attachment.createdAt, taskId, user.userId, user.userId, taskId, MAX_ATTACHMENTS).run();
    } catch (error) {
      // A failed response can be ambiguous; never delete bytes if D1 committed their reference.
      const committed = await db.prepare('SELECT id FROM attachments WHERE object_key = ? AND id = ?').bind(objectKey, id).first();
      if (!committed) await bucket.delete(objectKey);
      throw error;
    }
    if (!inserted.meta.changes) {
      await bucket.delete(objectKey);
      const retried = await db.prepare(`SELECT ${attachmentColumns} FROM attachments a WHERE a.id = ? AND a.owner = ? AND a.task_id = ?`).bind(id, user.userId, taskId).first<TaskAttachment>();
      if (retried) return json({ attachment: retried });
      return json({ error: 'This action changed or already has 10 files. Refresh before adding another file.' }, 409);
    }
    return json({ attachment }, 201);
  } catch (error) {
    console.error('Attachment upload failed', error);
    return json({ error: 'Could not upload this file. Your action is saved; please retry the file.' }, 503);
  }
}
