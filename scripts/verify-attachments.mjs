import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = process.env.APP_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Attachment verification writes only to a local database.');
const cookie = { Cookie: '__sites_local_auth=1' };
const foreignTaskId = crypto.randomUUID();
const foreignAttachmentId = crypto.randomUUID();
const ids = new Set();
const sqlString = value => `'${String(value).replaceAll("'", "''")}'`;
function localSql(command) {
  const output = execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'wrangler.local.json', '--command', command, '--json'], { encoding: 'utf8', env: { ...process.env, WRANGLER_WRITE_LOGS: 'false', WRANGLER_LOG_PATH: '.wrangler/logs' } });
  return JSON.parse(output)[0].results;
}
async function responseBody(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); } catch { return { error: raw }; }
}

async function api(path, method = 'GET', value, headers = cookie) {
  const options = { method, headers: { ...headers, ...(value ? { 'Content-Type': 'application/json' } : {}) } };
  if (value !== undefined && method !== 'GET') options.body = JSON.stringify(value);
  const response = await fetch(base + path, options);
  return { status: response.status, body: await responseBody(response) };
}

async function upload(taskId, { name = 'notes.txt', bytes = Buffer.from('Private supporting notes.\n'), type = 'text/plain', id = crypto.randomUUID(), size = bytes.length, headers = cookie } = {}) {
  const response = await fetch(`${base}/api/attachments?taskId=${encodeURIComponent(taskId)}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': type, 'X-File-Name': encodeURIComponent(name), 'X-File-Size': String(size), 'X-Attachment-Id': id }, body: bytes,
  });
  const body = await responseBody(response);
  if (response.ok) ids.add(body.attachment.id);
  return { status: response.status, body };
}

const now = new Date().toISOString();
let task = { id: crypto.randomUUID(), title: 'Attachment integration verification', notes: 'Private attachment tests', horizon: 'reference', project: '', people: [], places: [], due: '', minutes: 0, energy: '', completed: false, createdAt: now, updatedAt: now, version: 1 };
const created = await api('/api/tasks', 'POST', task);
assert.equal(created.status, 201, JSON.stringify(created.body));
task = created.body.task;
const path = id => `/api/attachments/${id}`;
const download = (id, headers = cookie) => fetch(base + path(id), { headers });
const reload = async () => (await api('/api/tasks')).body.tasks.find(item => item.id === task.id);

try {
  assert.equal((await upload(task.id, { headers: {} })).status, 401, 'Anonymous upload denied');
  assert.equal((await upload(task.id, { headers: { ...cookie, Origin: 'https://untrusted.example' } })).status, 403, 'Cross-origin upload denied');
  assert.equal((await upload(crypto.randomUUID())).status, 404, 'Unknown task upload denied');
  assert.equal((await upload(task.id, { bytes: Buffer.alloc(0) })).status, 400, 'Empty files rejected');
  assert.equal((await upload(task.id, { size: 10 * 1024 * 1024 + 1 })).status, 413, 'Oversize declaration rejected');
  assert.equal((await upload(task.id, { size: 2 })).status, 400, 'Dishonest size rejected by actual byte count');
  assert.equal((await upload(task.id, { size: 100 })).status, 400, 'Incomplete body rejected');
  assert.equal((await upload(task.id, { name: '../notes.txt' })).status, 400, 'Path filename rejected');
  assert.equal((await upload(task.id, { name: 'x'.repeat(241) })).status, 400, 'Overlong filename rejected');
  const boundaryBytes = Buffer.alloc(10 * 1024 * 1024, 0x5a);
  const boundary = await upload(task.id, { name: 'boundary.bin', bytes: boundaryBytes, type: 'application/octet-stream' });
  assert.equal(boundary.status, 201, 'Exactly 10 MB is accepted');
  assert.deepEqual(Buffer.from(await (await download(boundary.body.attachment.id)).arrayBuffer()), boundaryBytes, 'Maximum-size file downloads intact');
  await api(path(boundary.body.attachment.id), 'DELETE');

  const pdf = Buffer.from('%PDF-1.4\n%Attachment byte-preservation fixture\n%%EOF\n');
  let response = await upload(task.id, { name: 'résumé 日本語.pdf', type: 'application/pdf', bytes: pdf });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const first = response.body.attachment;
  let downloaded = await download(first.id);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf, 'PDF bytes survive upload/download');
  assert.equal(downloaded.headers.get('content-type'), 'application/octet-stream');
  assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.match(downloaded.headers.get('cache-control'), /private, no-store/);
  assert.match(downloaded.headers.get('content-disposition'), /attachment;.*filename\*=UTF-8''r%C3%A9sum%C3%A9/);
  assert.match(downloaded.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await download(first.id, {})).status, 401, 'Anonymous download denied');
  assert.equal((await api(path(first.id), 'DELETE', undefined, {})).status, 401, 'Anonymous removal denied');
  assert.equal((await api(path(first.id), 'DELETE', undefined, { ...cookie, Origin: 'https://untrusted.example' })).status, 403);

  response = await upload(task.id, { id: first.id, name: first.name, type: 'application/pdf', bytes: pdf });
  assert.equal(response.status, 200, 'Retry returns existing file');
  assert.equal((await reload()).attachments.length, 1, 'Retry does not duplicate metadata');

  // The local dispatcher strips custom identity headers. Seed a second owner's fixture
  // directly into the local DB, pointing at real test bytes to detect download leaks.
  const key = localSql(`SELECT object_key FROM attachments WHERE id = ${sqlString(first.id)}`)[0].object_key;
  localSql(`INSERT INTO tasks (id, owner, data, version, deleted) VALUES (${sqlString(foreignTaskId)}, 'attachment-test-other-owner', ${sqlString(JSON.stringify({ ...task, id: foreignTaskId }))}, 1, 0)`);
  localSql(`INSERT INTO attachments (id, task_id, owner, object_key, name, size, content_type, created_at) VALUES (${sqlString(foreignAttachmentId)}, ${sqlString(foreignTaskId)}, 'attachment-test-other-owner', ${sqlString(key)}, 'private.pdf', ${pdf.length}, 'application/pdf', ${sqlString(now)})`);
  assert.ok(!(await api('/api/tasks')).body.tasks.some(item => item.id === foreignTaskId), 'Other owner cannot list parent');
  assert.equal((await upload(foreignTaskId)).status, 404, 'Other owner cannot upload');
  assert.equal((await download(foreignAttachmentId)).status, 404, 'Other owner cannot download');
  await api(path(foreignAttachmentId), 'DELETE');
  assert.equal(localSql(`SELECT COUNT(*) AS count FROM attachments WHERE id = ${sqlString(foreignAttachmentId)}`)[0].count, 1, 'Other owner cannot remove');
  assert.equal((await download(first.id)).status, 200, 'Owner file bytes remain intact');

  response = await upload(task.id, { name: first.name, bytes: Buffer.from('A distinct file with the same name.\n') });
  assert.equal(response.status, 201, 'Duplicate filenames supported');
  const second = response.body.attachment;
  downloaded = await download(second.id);
  assert.equal(await downloaded.text(), 'A distinct file with the same name.\n', 'Non-PDF bytes retained');

  response = await api('/api/tasks', 'PUT', { ...task, attachments: [{ id: 'forged', name: 'evil.txt' }] });
  assert.equal(response.status, 200); task = response.body.task;
  assert.equal(task.attachments.length, 2, 'Task JSON cannot forge or erase attachment records');
  response = await api('/api/tasks', 'PUT', { ...task, completed: true }); task = response.body.task;
  assert.equal((await download(first.id)).status, 200, 'Completed action retains files');
  response = await api('/api/tasks', 'PUT', { ...task, deleted: true }); task = response.body.task;
  assert.equal((await download(first.id)).status, 404, 'Deleted parent hides downloads');
  assert.equal((await upload(task.id)).status, 404, 'Deleted parent blocks uploads');
  await api(path(first.id), 'DELETE');
  response = await api('/api/tasks', 'PUT', { ...task, deleted: false }); task = response.body.task;
  assert.equal(task.attachments.length, 2, 'Undo restores attachment metadata');
  assert.equal((await download(first.id)).status, 200, 'Undo restores file bytes');

  // Race multiple uploads at the final slot; the database must enforce capacity atomically.
  for (let i = 0; i < 7; i++) assert.equal((await upload(task.id)).status, 201);
  const race = await Promise.all([upload(task.id), upload(task.id), upload(task.id)]);
  assert.equal(race.filter(result => result.status === 201).length, 1);
  assert.equal(race.filter(result => result.status === 409).length, 2);
  assert.equal((await reload()).attachments.length, 10, 'Concurrent uploads cannot exceed capacity');
  assert.equal((await upload(task.id)).status, 409);
  assert.equal((await api(path(second.id), 'DELETE')).status, 200);
  assert.equal((await download(second.id)).status, 404, 'Removed file is unavailable');
  assert.equal((await api(path(second.id), 'DELETE')).status, 200, 'Removal retry is safe');
  assert.equal((await download(first.id)).status, 200, 'Other attachment remains available');
  assert.equal((await upload(task.id)).status, 201, 'Removal frees a slot');
  console.log('PASS: PDF/other file integrity, Unicode names, private download headers, auth/owner/origin controls, body limits, idempotent retries, filename duplicates, task metadata isolation, completion, delete/undo, concurrent count limits, and removal.');
} finally {
  localSql(`DELETE FROM attachments WHERE id = ${sqlString(foreignAttachmentId)}`);
  localSql(`DELETE FROM tasks WHERE id = ${sqlString(foreignTaskId)}`);
  // Recover parent visibility if a failing test stopped during the deletion check.
  if (task.deleted) { const restored = await api('/api/tasks', 'PUT', { ...task, deleted: false }); if (restored.status === 200) task = restored.body.task; }
  for (const id of ids) await api(path(id), 'DELETE');
  await api('/api/tasks', 'PUT', { ...task, deleted: true });
}
