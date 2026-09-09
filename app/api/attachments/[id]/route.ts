import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAttachmentBucket, getRawDb } from '@/db';
import { privateJson as json, sameOrigin } from '@/lib/attachment-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function findAttachment(id: string, owner: string) {
  return getRawDb().prepare(`SELECT a.object_key, a.name, a.size FROM attachments a
    JOIN tasks t ON t.id = a.task_id AND t.owner = a.owner
    WHERE a.id = ? AND a.owner = ? AND t.deleted = 0`).bind(id, owner).first<{ object_key: string; name: string; size: number }>();
}

export async function GET(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in again to download files.' }, 401);
  try {
    const attachment = await findAttachment((await context.params).id, user.userId);
    if (!attachment) return json({ error: 'This file is no longer available.' }, 404);
    const object = await getAttachmentBucket().get(attachment.object_key);
    if (!object) return json({ error: 'This file could not be found.' }, 404);
    const fallback = attachment.name.replace(/[^a-zA-Z0-9._ -]/g, '_');
    const encoded = encodeURIComponent(attachment.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(object.body, { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch (error) {
    console.error('Attachment download failed', error);
    return json({ error: 'Could not download this file. Please try again.' }, 503);
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Sign in again to remove files.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const id = (await context.params).id;
    const attachment = await findAttachment(id, user.userId);
    if (!attachment) return json({ removed: true });
    await getRawDb().prepare(`DELETE FROM attachments WHERE id = ? AND owner = ?
      AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id = attachments.task_id AND tasks.owner = ? AND tasks.deleted = 0)`).bind(id, user.userId, user.userId).run().then(async result => {
      if (result.meta.changes) {
        // Metadata is authoritative: a cleanup failure never exposes a removed file.
        try { await getAttachmentBucket().delete(attachment.object_key); }
        catch (error) { console.error('Attachment storage cleanup failed', error); }
      }
    });
    return json({ removed: true });
  } catch (error) {
    console.error('Attachment removal failed', error);
    return json({ error: 'Could not remove this file. Please try again.' }, 503);
  }
}
