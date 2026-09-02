#!/usr/bin/env node
// إشمون — ناشر إنستغرام التلقائي
// الاستخدام:
//   node ig-poster.mjs post <فيديو.mp4> <ملف-كابشن.txt>            نشر فوري كريل
//   node ig-poster.mjs watch                                       مراقبة مجلد outbox والنشر حسب الجدولة
//   node ig-poster.mjs comments [عدد]                              قراءة آخر التعليقات
//   node ig-poster.mjs reply <commentId> <نص>                      رد على تعليق
//   node ig-poster.mjs hide <commentId>                            إخفاء تعليق
//
// الإعداد: انسخ ig.config.example.json إلى ig.config.json واملأه. لا ترفعه لgit.

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'ig.config.json');
const OUTBOX = path.join(__dirname, 'outbox');
const SENT = path.join(OUTBOX, 'sent');
const FAILED = path.join(OUTBOX, 'failed');

const log = (...a) => console.log(new Date().toISOString(), '|', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error('لا يوجد ig.config.json — انسخ المثال واملأه أولاً.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

const cfg = loadConfig();
const API = cfg.apiHost || 'https://graph.instagram.com';
const VER = cfg.apiVersion || 'v23.0';

async function api(endpoint, params = {}, method = 'GET') {
  const url = new URL(`${API}/${VER}/${endpoint}`);
  if (method === 'GET') Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('access_token', cfg.accessToken);
  const res = await fetch(url, method === 'GET' ? {} : {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API ${endpoint}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// ---------- رفع الفيديو إلى سوبا بيز (يجب أن يكون الرابط عاماً لمتطلبات ميتا) ----------
async function uploadToSupabase(videoPath) {
  const objectName = `reels/${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(videoPath)}`;
  const body = await new Response(createReadStream(videoPath)).arrayBuffer ? null : null; // placeholder
  const buf = readFileSync(videoPath); // فيديوهات الريلز صغيرة (<90MB عادة)
  const res = await fetch(
    `${cfg.supabaseUrl}/storage/v1/object/${cfg.supabaseBucket}/${objectName}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.supabaseServiceKey}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body: buf,
    }
  );
  if (!res.ok) throw new Error(`رفع سوبا بيز فشل: ${res.status} ${await res.text()}`);
  return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.supabaseBucket}/${objectName}`;
}

// ---------- النشر كريل ----------
export async function publishReel(videoPath, caption) {
  log('١/٤ رفع الفيديو إلى سوبا بيز…');
  const videoUrl = await uploadToSupabase(videoPath);
  log('   الرابط العام:', videoUrl);

  log('٢/٤ إنشاء الحاوية…');
  const container = await api(`${cfg.igUserId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: 'true',
  }, 'POST');
  log('   container:', container.id);

  log('٣/٤ انتظار معالجة ميتا…');
  for (let i = 0; i < 60; i++) {
    const st = await api(container.id, { fields: 'status_code' });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR') throw new Error('ميتا رفضت الفيديو (ترميز أو مدة).');
    await sleep(5000);
  }

  log('٤/٤ النشر…');
  const pub = await api(`${cfg.igUserId}/media_publish`, { creation_id: container.id }, 'POST');
  log('✅ منشور! media id:', pub.id);
  return pub.id;
}

// ---------- إدارة التعليقات ----------
async function listComments(limit = 10) {
  const media = await api(`${cfg.igUserId}/media`, { fields: 'id,caption,timestamp', limit: 5 });
  for (const m of media.data || []) {
    const cs = await api(`${m.id}/comments`, { fields: 'id,text,username,timestamp' }).catch(() => ({ data: [] }));
    for (const c of (cs.data || []).slice(0, limit)) {
      console.log(`[${c.timestamp}] @${c.username} (${c.id})\n  ${c.text}\n`);
    }
  }
}
async function replyComment(commentId, text) {
  await api(`${commentId}/replies`, { message: text }, 'POST');
  log('✅ تم الرد');
}
async function hideComment(commentId) {
  await api(commentId, { hide: true }, 'POST');
  log('✅ تم الإخفاء');
}

// ---------- المراقبة والجدولة (outbox/*.json) ----------
// كل مهمة: { "when": "2026-08-27T18:30", "video": "مسار.mp4", "caption": "…" }
async function watchLoop() {
  [SENT, FAILED].forEach(d => mkdirSync(d, { recursive: true }));
  log('مراقبة outbox… (Ctrl+C للإيقاف)');
  for (;;) {
    for (const f of readdirSync(OUTBOX)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(OUTBOX, f);
      try {
        const job = JSON.parse(readFileSync(full, 'utf8'));
        if (new Date(job.when) > new Date()) continue;
        log('حان وقت:', f);
        await publishReel(path.resolve(__dirname, job.video), job.caption);
        renameSync(full, path.join(SENT, f));
      } catch (e) {
        log('❌ فشل:', e.message);
        try { renameSync(full, path.join(FAILED, f)); } catch {}
      }
    }
    await sleep(60000);
  }
}

// ---------- CLI ----------
const [, , cmd, ...args] = process.argv;
try {
  if (cmd === 'post') {
    const caption = existsSync(args[1]) ? readFileSync(args[1], 'utf8').trim() : args[1];
    await publishReel(path.resolve(args[0]), caption);
  } else if (cmd === 'watch') await watchLoop();
  else if (cmd === 'comments') await listComments(Number(args[0]) || 10);
  else if (cmd === 'reply') await replyComment(args[0], args.slice(1).join(' '));
  else if (cmd === 'hide') await hideComment(args[0]);
  else console.log('الأوامر: post | watch | comments | reply | hide  — شاهد الترويسة للأمثلة');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
