import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getRawDb } from '@/db';
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Sign in to save your review.' }, { status: 401 });
  const origin = request.headers.get('origin'); if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Request not allowed.' }, { status: 403 });
  try { const finishedAt = new Date().toISOString(); await getRawDb().prepare('INSERT INTO reviews (owner, finished_at) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET finished_at = excluded.finished_at').bind(user.userId, finishedAt).run(); return Response.json({ finishedAt }, { headers: { 'Cache-Control': 'no-store' } }); } catch { return Response.json({ error: 'Your review could not be saved. Please try again.' }, { status: 503 }); }
}
