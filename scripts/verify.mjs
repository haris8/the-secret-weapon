import assert from 'node:assert/strict';
const base = process.env.APP_URL || 'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'This integration check writes only to a local development database.');
async function request(path, method='GET', value, authenticated=true, extra={}) {
  const response=await fetch(base+path,{method,headers:{...(authenticated?{Cookie:'__sites_local_auth=1'}:{}),...(value?{'Content-Type':'application/json'}:{}),...extra},body:value?JSON.stringify(value):undefined});
  const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{body={error:raw};}return {status:response.status,body};
}
assert.equal((await request('/api/tasks','GET',undefined,false)).status,401,'Anonymous read denied');
const initial=await request('/api/tasks'); assert.equal(initial.status,200,JSON.stringify(initial.body));
const now=new Date().toISOString(); let task={id:crypto.randomUUID(),title:'Integration verification action',notes:'Notes and contexts survive a reload.',horizon:'inbox',project:'Verification',people:['Alex'],places:['Home'],due:'',minutes:15,energy:'low',completed:false,createdAt:now,updatedAt:now,version:1};
assert.equal((await request('/api/tasks','POST',{...task,title:'   '})).status,400,'Empty title rejected');
assert.equal((await request('/api/tasks','POST',{...task,horizon:'invalid'})).status,400,'Invalid horizon rejected');
assert.equal((await request('/api/tasks','POST',{...task,due:'2026-02-30'})).status,400,'Invalid date rejected');
assert.equal((await request('/api/tasks','POST',task,false)).status,401,'Anonymous write denied');
assert.equal((await request('/api/tasks','POST',task,true,{Origin:'https://untrusted.example'})).status,403,'Cross-origin write denied');
let response=await request('/api/tasks','POST',task);assert.equal(response.status,201,JSON.stringify(response.body));task=response.body.task;
try {
  assert.equal((await request('/api/tasks','POST',task)).status,409,'Duplicate creation is not duplicated');
  const read=(await request('/api/tasks')).body.tasks.find(t=>t.id===task.id);assert.deepEqual(read,task,'Saved action survives read-back');
  const stale={...task}; response=await request('/api/tasks','PUT',{...task,horizon:'now',people:[],places:[]});assert.equal(response.status,200);task=response.body.task;
  assert.deepEqual(task.people,[],'Last person can be removed');assert.equal(task.horizon,'now');
  assert.equal((await request('/api/tasks','PUT',{...stale,title:'Stale overwrite'})).status,409,'Concurrent change protected');
  assert.equal((await request('/api/tasks','PUT',{...task,id:crypto.randomUUID()})).status,404,'Unknown/unowned record cannot be changed');
  response=await request('/api/tasks','PUT',{...task,completed:true});assert.equal(response.status,200);task=response.body.task;
  assert.equal((await request('/api/tasks')).body.tasks.find(t=>t.id===task.id).completed,true,'Completion persists');
  response=await request('/api/tasks','PUT',{...task,completed:false});assert.equal(response.status,200);task=response.body.task;
  response=await request('/api/tasks','PUT',{...task,deleted:true});assert.equal(response.status,200);task=response.body.task;
  assert.ok(!(await request('/api/tasks')).body.tasks.some(t=>t.id===task.id),'Deleted task hidden');
  response=await request('/api/tasks','PUT',{...task,deleted:false});assert.equal(response.status,200);task=response.body.task;
  assert.ok((await request('/api/tasks')).body.tasks.some(t=>t.id===task.id),'Undo deletion restores task');
  assert.equal((await request('/api/review','POST',undefined,false)).status,401,'Review requires identity');
  assert.equal((await request('/api/review','POST',undefined,true,{Origin:'https://untrusted.example'})).status,403,'Review rejects cross-origin request');
  const review=await request('/api/review','POST');assert.equal(review.status,200);assert.equal((await request('/api/tasks')).body.lastReview,review.body.finishedAt,'Review completion persists');
  console.log('PASS: authentication, validation, origin checks, capture/read-back, context removal, stale-write protection, completion/restore, delete/undo, review persistence.');
} finally { await request('/api/tasks','PUT',{...task,deleted:true}); }
const manifest=await fetch(base+'/manifest.webmanifest');assert.equal(manifest.status,200);const pwa=await manifest.json();assert.equal(pwa.display,'standalone');
for(const icon of pwa.icons)assert.equal((await fetch(base+icon.src)).status,200);
assert.equal((await fetch(base+'/sw.js')).status,200);assert.equal((await fetch(base+'/offline.html')).status,200);
console.log('PASS: install manifest, icons, service worker, and public offline notice.');
