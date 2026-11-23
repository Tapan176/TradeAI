'use strict';
/* Permanent memory = a private GitHub repo that doubles as an Obsidian vault. Zero dependencies: GitHub Git Data API, many files per commit.
 * ENV: VAULT_REPO=owner/name · VAULT_TOKEN=fine-grained PAT (Contents: read+write on that one repo) · VAULT_BRANCH=main · VAULT_DIR=Bot (the bot only writes under this folder)
 * Files are queued with put() and committed in batches by flush() (every VAULT_FLUSH_MIN minutes, on shutdown, and when the queue is large). */
const E = process.env, REPO = (E.VAULT_REPO || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''), TOKEN = E.VAULT_TOKEN || '', BRANCH = E.VAULT_BRANCH || 'main', DIR = (E.VAULT_DIR || 'Bot').replace(/^\/|\/$/g, '');
const configured = () => !!(REPO && TOKEN);
const q = new Map(), st = { commits: 0, files: 0, lastCommit: null, lastAt: 0, lastError: null, flushing: false, loaded: 0 };
async function gh(method, path, body, accept) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 30000);
  try {
    const r = await fetch('https://api.github.com/repos/' + REPO + path, { method, headers: { Authorization: 'Bearer ' + TOKEN, Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'paperbot-vault', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: c.signal });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { /* raw */ }
    return { status: r.status, ok: r.ok, j, txt };
  } finally { clearTimeout(t); }
}
const full = rel => DIR + '/' + rel.replace(/^\/+/, '');
function put(rel, content) { if (!configured()) return; q.set(rel, typeof content === 'string' ? content : JSON.stringify(content)); }
async function ensureBranch() {
  let r = await gh('GET', '/git/ref/heads/' + encodeURIComponent(BRANCH));
  if (r.status === 404 || r.status === 409) {   // empty repo: create the first commit through the contents API
    const c = await gh('PUT', '/contents/' + full('README.md'), { message: 'init vault', content: Buffer.from('# PaperBot vault\nWritten by the bot. Do not edit files under this folder by hand; put your own notes elsewhere.\n').toString('base64'), branch: BRANCH });
    if (!c.ok && c.status !== 422) throw new Error('init ' + c.status + ' ' + (c.j && c.j.message));
    r = await gh('GET', '/git/ref/heads/' + encodeURIComponent(BRANCH));
  }
  if (!r.ok) throw new Error('ref ' + r.status + ' ' + (r.j && r.j.message || ''));
  return r.j.object.sha;
}
async function flush(msg) {
  if (!configured() || st.flushing || !q.size) return { ok: true, files: 0 };
  st.flushing = true; const batch = new Map(q); q.clear();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const head = await ensureBranch();
      const cm = await gh('GET', '/git/commits/' + head); if (!cm.ok) throw new Error('commit ' + cm.status);
      const entries = Array.from(batch.entries()).map(([p, content]) => ({ path: full(p), mode: '100644', type: 'blob', content }));
      const tr = await gh('POST', '/git/trees', { base_tree: cm.j.tree.sha, tree: entries }); if (!tr.ok) throw new Error('tree ' + tr.status + ' ' + (tr.j && tr.j.message || ''));
      const nc = await gh('POST', '/git/commits', { message: msg || ('Lab sync · ' + batch.size + ' files · ' + new Date().toISOString().slice(0, 16) + 'Z'), tree: tr.j.sha, parents: [head] }); if (!nc.ok) throw new Error('newcommit ' + nc.status);
      const up = await gh('PATCH', '/git/refs/heads/' + encodeURIComponent(BRANCH), { sha: nc.j.sha, force: false });
      if (up.ok) { st.commits++; st.files += batch.size; st.lastCommit = nc.j.sha.slice(0, 7); st.lastAt = Date.now(); st.lastError = null; return { ok: true, files: batch.size }; }
      if (up.status !== 422 && up.status !== 409) throw new Error('ref update ' + up.status + ' ' + (up.j && up.j.message || ''));
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));   // someone pushed in between (e.g. you via Obsidian Git): rebuild on the new head
    }
    throw new Error('could not fast-forward after 3 tries');
  } catch (e) { for (const [k, v] of batch) if (!q.has(k)) q.set(k, v); st.lastError = e.message; return { ok: false, error: e.message }; }
  finally { st.flushing = false; }
}
async function get(rel) {
  if (!configured()) return null;
  try { const r = await gh('GET', '/contents/' + full(rel) + '?ref=' + encodeURIComponent(BRANCH), null, 'application/vnd.github.raw+json'); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); st.loaded++; return r.txt; }
  catch (e) { st.lastError = 'read ' + rel + ': ' + e.message; return null; }
}
const status = () => ({ configured: configured(), repo: REPO || null, branch: BRANCH, dir: DIR, queued: q.size, commits: st.commits, files: st.files, lastCommit: st.lastCommit, lastAt: st.lastAt, lastError: st.lastError, loaded: st.loaded });
module.exports = { configured, put, flush, get, status };
