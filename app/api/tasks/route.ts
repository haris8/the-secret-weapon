import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getRawDb } from '@/db';
import { validateTask } from '@/lib/validation';
export const dynamic = 'force-dynamic';
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
function sameOrigin(request: Request) { const origin = request.headers.get('origin'); return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site'; }
export async function GET() {
  const user = await getChatGPTUser(); if (!user) return json({ error: 'Sign in to open your private workspace.' }, 401);
  try {
    const db = getRawDb(); const result = await db.prepare('SELECT data, version FROM tasks WHERE owner = ? AND deleted = 0 ORDER BY rowid DESC').bind(user.userId).all<{ data: string; version: number }>();
    const review = await db.prepare('SELECT finished_at FROM reviews WHERE owner = ?').bind(user.userId).first<{ finished_at: string }>();
    return json({ tasks: result.results.map(row => ({ ...JSON.parse(row.data), version: row.version })), lastReview: review?.finished_at ?? null, userKey: user.userId });
  } catch (error) { console.error('Task load failed', error); return json({ error: 'Your workspace could not be loaded. Please try again.' }, 503); }
}
async function write(request: Request, isNew: boolean) {
  const user = await getChatGPTUser(); if (!user) return json({ error: 'Your session ended. Sign in again to save.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  let task; try { const raw = await request.text(); if (raw.length > 80000) return json({ error: 'This action is too large.' }, 413); task = validateTask(JSON.parse(raw)); } catch (error) { return json({ error: error instanceof Error ? error.message : 'Please check this action.' }, 400); }
  try {
    const db = getRawDb(); const now = new Date().toISOString();
    if (isNew) {
      const saved = { ...task, createdAt: now, updatedAt: now, version: 1, deleted: false };
      const result = await db.prepare('INSERT INTO tasks (id, owner, data, version, deleted) VALUES (?, ?, ?, 1, 0) ON CONFLICT(id) DO NOTHING').bind(task.id, user.userId, JSON.stringify(saved)).run();
      if (!result.meta.changes) return json({ error: 'This action already exists. Refresh your workspace before retrying.' }, 409);
      return json({ task: saved }, 201);
    }
    const existing = await db.prepare('SELECT data FROM tasks WHERE id = ? AND owner = ?').bind(task.id, user.userId).first<{ data: string }>();
    if (!existing) return json({ error: 'This action no longer exists.' }, 404);
    const saved = { ...task, createdAt: JSON.parse(existing.data).createdAt, updatedAt: now, version: task.version + 1 };
    const result = await db.prepare('UPDATE tasks SET data = ?, version = version + 1, deleted = ? WHERE id = ? AND owner = ? AND version = ?').bind(JSON.stringify(saved), saved.deleted ? 1 : 0, task.id, user.userId, task.version).run();
    if (!result.meta.changes) return json({ error: 'This action changed on another device. Your draft is still here. Close it, refresh, and reopen the latest action before editing.' }, 409);
    return json({ task: saved });
  } catch (error) { console.error('Task save failed', error); return json({ error: 'Could not save. Your draft is still here; please try again.' }, 503); }
}
export async function POST(request: Request) { return write(request, true); }
export async function PUT(request: Request) { return write(request, false); }
