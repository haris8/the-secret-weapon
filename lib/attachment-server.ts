import { getRawDb } from '@/db';
import type { TaskAttachment } from './attachments';

export const attachmentColumns = 'a.id, a.task_id AS taskId, a.name, a.size, a.content_type AS contentType, a.created_at AS createdAt';

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}

export async function taskAttachments(owner: string, taskId?: string) {
  const result = await getRawDb().prepare(`SELECT ${attachmentColumns} FROM attachments a
    JOIN tasks t ON t.id = a.task_id AND t.owner = a.owner
    WHERE a.owner = ? AND t.deleted = 0 ${taskId ? 'AND a.task_id = ?' : ''}
    ORDER BY a.created_at, a.id`).bind(...(taskId ? [owner, taskId] : [owner])).all<TaskAttachment>();
  return result.results;
}
