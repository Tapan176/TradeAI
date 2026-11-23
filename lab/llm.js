'use strict';
/* LLM client: any OpenAI-compatible endpoint (OpenRouter by default; an OmniRoute / LiteLLM / local gateway via LLM_BASE_URL).
 * ENV: LLM_API_KEY (or OPENROUTER_API_KEY) · LLM_BASE_URL (default https://openrouter.ai/api/v1) · LLM_MODELS (comma list, tried in order; default = current free reasoning models)
 *      LLM_FALLBACK (optional paid model id, e.g. openai/gpt-oss-120b, appended to the chain) · LLM_DAILY_CAP (calls/day; auto = 45 on an OpenRouter free account, 900 otherwise)
 * Guarantees: serialised calls (<= LLM_RPM per minute, default 18), JSON validated by the caller's validator, budget split per bot, nothing throws — failures return {ok:false}. */
const E = process.env;
const KEY = E.LLM_API_KEY || E.OPENROUTER_API_KEY || '';
const BASE = (E.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const IS_OR = /openrouter\.ai/.test(BASE);
const MODELS = (E.LLM_MODELS || 'nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-lightning:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,openrouter/free').split(',').map(s => s.trim()).filter(Boolean).concat(E.LLM_FALLBACK ? [E.LLM_FALLBACK.trim()] : []);
const RPM = +E.LLM_RPM || 18, TIMEOUT = +E.LLM_TIMEOUT_MS || 60000;
const SHARE = { B: 0.50, C: 0.28, C0: 0.10, D: 0.07, R: 0.05 };   // daily budget split: B llm-only, C hybrid(memory), C0 hybrid control, D telegram parser, R reflection
const st = { day: '', calls: 0, ok: 0, fail: 0, by: {}, models: {}, last: null, lastError: null, cap: +E.LLM_DAILY_CAP || 0, tier: null, tokens: 0, penaltyUntil: 0, lastCallAt: 0, keyInfo: null };
function today() { return new Date().toISOString().slice(0, 10); }
function roll() { if (st.day !== today()) { st.day = today(); st.calls = 0; st.ok = 0; st.fail = 0; st.by = {}; st.tokens = 0; } }
const configured = () => !!KEY;
async function discoverCap() {   // OpenRouter: free accounts (< $10 credit) get 50 free-model requests/day, funded accounts 1000
  if (st.cap || !KEY || !IS_OR) { if (!st.cap) st.cap = 900; return; }
  try {
    const r = await fetch(BASE + '/key', { headers: { Authorization: 'Bearer ' + KEY } }); const j = await r.json(), d = j.data || {};
    st.keyInfo = { label: d.label, free: d.is_free_tier, usage: d.usage, limit: d.limit };
    st.tier = d.is_free_tier ? 'free' : 'funded'; st.cap = d.is_free_tier ? 45 : 900;
  } catch (e) { st.cap = 45; st.tier = 'unknown'; }
}
function allow(bot) {   // budget governor: each bot gets its share of the day's cap
  roll(); if (!KEY) return false; if (Date.now() < st.penaltyUntil) return false;
  const cap = st.cap || 45; if (st.calls >= cap * 0.9) return false;
  return (st.by[bot] || 0) < Math.max(1, Math.floor(cap * (SHARE[bot] || 0.05)));
}
let chain = Promise.resolve();
function call(bot, messages, opt) { const p = chain.then(() => run(bot, messages, opt || {})); chain = p.catch(() => {}); return p; }
async function run(bot, messages, opt) {
  roll(); const t0 = Date.now();
  if (!KEY) return { ok: false, error: 'no LLM key' };
  const gap = 60000 / RPM - (Date.now() - st.lastCallAt); if (gap > 0) await new Promise(r => setTimeout(r, gap));
  st.lastCallAt = Date.now(); st.calls++; st.by[bot] = (st.by[bot] || 0) + 1;
  const mk = (maxTok, model) => { const b = { messages, temperature: opt.temperature == null ? 0.1 : opt.temperature, max_tokens: maxTok, response_format: { type: 'json_object' } }; if (IS_OR) { b.models = MODELS.slice(0, 3); b.model = model || MODELS[0]; } else b.model = model || MODELS[0]; return b; };
  const c = new AbortController(), to = setTimeout(() => c.abort(), TIMEOUT);
  try {
    let j, data = null, why = '', body = mk(opt.maxTokens || 700);
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      // 2nd attempt (only when the 1st reply was not usable JSON): double the token budget and prefer the next model in the list
      if (attempt) { st.calls++; st.by[bot] = (st.by[bot] || 0) + 1; body = mk(Math.min(1600, (opt.maxTokens || 700) * 2), MODELS[1] || MODELS[0]); }
      const r = await fetch(BASE + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'HTTP-Referer': E.SELF_URL || 'https://paperbot.local', 'X-Title': 'PaperBot Lab' }, body: JSON.stringify(body), signal: c.signal });
      if (r.status === 429 || r.status === 402) { const ra = +r.headers.get('retry-after') || 60; st.penaltyUntil = Date.now() + Math.min(ra, 900) * 1000; throw new Error('HTTP ' + r.status + ' (backing off ' + ra + 's)'); }
      const txt = await r.text(); try { j = JSON.parse(txt); } catch (e) { throw new Error('HTTP ' + r.status + ' non-JSON reply'); }
      if (!r.ok || j.error) throw new Error('HTTP ' + r.status + ' ' + String((j.error && (j.error.message || j.error)) || '').slice(0, 160));
      const ch = j.choices && j.choices[0], m = ch && ch.message, content = m && (m.content || '');
      data = extractJson(content) || extractJson(m && (m.reasoning || m.reasoning_content));
      if (!data) why = 'reply was not valid JSON (' + (j.model || body.model) + ', finish=' + (ch && ch.finish_reason) + ', ' + String(content || '').length + ' chars' + (content ? ': ' + String(content).replace(/\s+/g, ' ').slice(0, 70) : '') + ')';
    }
    if (!data) throw new Error(why);
    if (opt.validate) { const bad = opt.validate(data); if (bad) throw new Error('schema: ' + bad); }
    st.ok++; st.models[j.model || body.model] = (st.models[j.model || body.model] || 0) + 1; st.tokens += (j.usage && j.usage.total_tokens) || 0;
    st.last = { at: Date.now(), bot, model: j.model || body.model, ms: Date.now() - t0 };
    return { ok: true, data, model: j.model || body.model, ms: Date.now() - t0 };
  } catch (e) { st.fail++; st.lastError = { at: Date.now(), bot, msg: e.name === 'AbortError' ? 'timeout' : e.message }; return { ok: false, error: st.lastError.msg }; }
  finally { clearTimeout(to); }
}
function extractJson(s) {
  if (!s) return null; s = String(s).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try { return JSON.parse(s); } catch (e) { /* fallthrough */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* ignore */ } }
  return null;
}
function status() { roll(); return { configured: configured(), base: BASE, models: MODELS, tier: st.tier, cap: st.cap, calls: st.calls, ok: st.ok, fail: st.fail, by: st.by, usedModels: st.models, last: st.last, lastError: st.lastError, tokens: st.tokens, backingOff: Date.now() < st.penaltyUntil, keyInfo: st.keyInfo, share: SHARE }; }
module.exports = { call, allow, status, configured, discoverCap, extractJson, SHARE };
