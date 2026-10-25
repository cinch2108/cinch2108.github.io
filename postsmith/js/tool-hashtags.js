// Offline hashtag generator: keyword matching against curated topic lists.
import { $, $$, esc, icon, copyText, ls, debounce, toast } from './ui.js';
import { TOPICS, GENERIC, PLATFORM_TAGS } from './hashtag-data.js';

const STOP = new Set('a an and are as at be but by for from has have how i in into is it its my of on or our so that the their this to was we what when where who why will with you your new best top day today post about just really very get got make made'.split(' '));
const EXTRA = 'of in the for my me life love lover lovers day days time tips ideas style home work free first new daily good vibes blogger community inspo inspiration owner shop local support with made makers gonna make projects solo hidden gems bucket list road trip budget getaway opt outside get view salt coastal living what i wore street wear tutorial glowing skin nail clean golden hour film digital sketch book oil painting process brand identity web product apartment therapy spaces makeover styling urban jungle grow your own vegetable parent mom dad rescue adopt dont pet hacks gentle firsts moms to be just married behind scenes packing orders batch social media personal branding strategy economy advice search remote open financial freedom saving money stock market literacy passive income debt tok build setup generative tools prompt engineering future deep development 100 code dev source engineer learn public indie game retro producer live original studio challenge hip hop video contemporary recommendations currently reading worm am fantasy club writers short story publishing horror movies twitter binge watching gram teachers something ed student mental health matters gut healthy habits wellness journey meal prep sunday motivational quotes improvement electric vehicles classic culture super match sports fan listed dream buyer hunting real estate agent event festival profs zero waste reuse plastic slow climate action giving back difference decor costume years resolution fit over 40 progress not perfection power trainer fam glutes leg strength runners half ultra chat couch long practice every flow teacher mindful moments inner peace easy whats one pot comfort air fryer weeknight scratch decorating bakers sweet tooth making cupcakes recipes plant based eats meatless monday cruelty dairy specialty pour addict photo oftheday photographer portrait landscape interior design artists artwork illustration artist graphic logo ui ux typography designer watercolor procreate handmade crafts upcycling crochet knitting sewing woodworking ideas plants gardening garden succulents houseplants dogs cats dog cat puppy toddler family baby wedding bride planning dress engaged business entrepreneur founder startup bootstrapping solopreneur small launch marketing content creator seo career job interview leadership finance investing budgeting tech review iphone android pc gadget ai machine learning automation coding programming developer javascript python software gaming gamer video games pc ps5 nintendo switch xbox twitch streamer esports music musician singer songwriter guitarist pianist spotify dance dancer ballet books bookstagram booklover bookworm writing writer poetry author movies cinema filmmaking netflix education students study studytips edtech homeschool nutrition healthylifestyle selfcare motivation mindset success growth positive morning routine cars car automotive jdm motorcycle supercars football soccer basketball nba nfl golf tennis gameday matchday realestate realtor property house home openhouse events party nightlife sustainability ecofriendly sustainable fashion slow nonprofit charity volunteer fundraising holidays christmas halloween fall holiday season cozy spring travel gram wanderlust adventure explore vacation backpacking roadtrip hiking outdoors nature mountains camping trail head backpacking beach summer ocean sunset island surfing tropical ootd outfit beauty makeup skincare grwm haircare fitness gym workout training health legday hiit calisthenics powerlifting running marathon trail yoga meditation mindfulness pilates breathwork yin food foodie cooking homemade delicious recipe dinner comfort baking dessert cake sourdough cookies bread pastry vegan vegetarian coffee espresso latte art barista cafe lover addict shot instagram insta tiktok linkedin youtube threads';

let DICT;
function dict() {
  if (DICT) return DICT;
  DICT = new Set(EXTRA.split(' '));
  TOPICS.forEach((t) => t.kw.forEach((w) => DICT.add(w)));
  return DICT;
}
/** Split a lowercase tag into words for #CamelCase (screen readers read those correctly). */
export function camel(tag) {
  if (/[A-Z]/.test(tag)) return tag;
  const D = dict(), n = tag.length, best = Array(n + 1).fill(null); best[0] = { s: 0, parts: [] };
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 16); j < i; j++) {
    const w = tag.slice(j, i); if (!best[j] || !(D.has(w) || /^\d+$/.test(w))) continue;
    const sc = best[j].s + w.length * w.length;
    if (!best[i] || sc > best[i].s) best[i] = { s: sc, parts: [...best[j].parts, w] };
  }
  const parts = best[n] ? best[n].parts : [tag];
  return parts.map((w) => (w === 'ui' || w === 'ux' || w === 'ai' || w === 'diy' || w === 'jdm' || w === 'grwm' || w === 'pc' || w === 'nba' || w === 'nfl' || w === 'seo' || w === 'tbr' ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join('');
}

const stem = (w) => w.replace(/(ings|ing|ers|er|ies|es|s)$/, (m) => (m === 'ies' ? 'y' : '')) || w;
export function tokens(text) {
  return (String(text).toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1 && !STOP.has(w)).slice(0, 40);
}
const clean = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}_]+/gu, '').slice(0, 60);

/** Generate candidate tags. Returns { topics, keyword:[], broad:[], niche:[] } (no # prefix). */
export function generate(text, { topicIds = [], location = '' } = {}) {
  const toks = tokens(text); const stems = new Set(toks.map(stem)); const tokset = new Set(toks);
  const scored = TOPICS.map((t, i) => {
    let s = 0;
    t.kw.forEach((k) => { if (tokset.has(k)) s += 3; else if (stems.has(stem(k))) s += 2; });
    [...t.broad, ...t.niche].forEach((tag) => { toks.forEach((w) => { if (w.length >= 4 && tag.includes(w)) s += 1; }); });
    if (topicIds.includes(t.id)) s += 100;
    return { t, s, i };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 3);
  const used = new Set(); const take = (arr) => arr.filter((x) => x && x.length >= 2 && !used.has(x) && used.add(x));
  const curated = new Set(TOPICS.flatMap((t) => [...t.broad, ...t.niche]));
  const loc = clean(location);
  // adjacency from the original word sequence (stopwords break pairs)
  const all = (String(text).toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).slice(0, 60);
  const cand = new Map(); const add = (w, sc) => { w = clean(w); if (w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w)) cand.set(w, Math.max(cand.get(w) || 0, sc + (curated.has(w) ? 3 : 0))); };
  all.forEach((w, i) => { if (STOP.has(w) || w.length < 2) return; add(w, 2); const nx = all[i + 1]; if (nx && !STOP.has(nx) && nx.length > 1) add(w + nx, 1); });
  if (loc) { add(loc, 2.5); scored.slice(0, 1).forEach(({ t }) => add(loc + t.kw[0], 2.2)); }
  const keyword = take([...cand].sort((a, b) => b[1] - a[1]).map((x) => x[0])).slice(0, 12);
  const rank = (tag) => toks.reduce((s, w) => s + (w.length >= 3 && tag.includes(w) ? 1 : 0), 0);
  const nicheAll = scored.flatMap(({ t }, ti) => t.niche.map((tag, k) => ({ tag, r: rank(tag) * 10 - ti * 2 - k * 0.01 })));
  const niche = take(nicheAll.sort((a, b) => b.r - a.r).map((x) => x.tag)).slice(0, 24);
  const broad = take(scored.flatMap(({ t }) => t.broad)).slice(0, 10);
  return { topics: scored.map((x) => x.t), keyword, broad, niche };
}

export function mount(panel) {
  const st = ls.get('ps-ht', {}) || {};
  panel.innerHTML = `
  <div class="stack">
    <p class="note">${icon('info')}<span><b>Honest note:</b> this works offline from hand-picked topic lists and your own keywords. It does <b>not</b> use live trend or volume data, and no one can guarantee reach. Check a tag on the platform before relying on it.</span></p>
    <div class="grid2">
      <label class="field"><span>Describe your post (keywords or a caption)</span><textarea id="htIn" rows="3" maxlength="1000" placeholder="e.g. homemade sourdough bread recipe for beginners" data-testid="ht-input"></textarea></label>
      <div class="stack">
        <label class="field"><span>Platform</span><select id="htPlat" data-testid="ht-platform">${PLATFORM_TAGS.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.min === p.max ? p.min : `${p.min}–${p.max}`})</option>`).join('')}</select></label>
        <div class="grid2"><label class="field"><span>Location (optional)</span><input type="text" id="htLoc" maxlength="40" placeholder="e.g. Austin"></label>
        <label class="field"><span>Or pick a topic</span><select id="htTopic"><option value="">Auto-detect</option>${TOPICS.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label></div>
      </div>
    </div>
    <div class="row nogrow wrap">
      <label class="switch-row"><input type="checkbox" class="switch" id="htCamel"> <span>#CamelCase (screen-reader friendly)</span></label>
      <button class="btn btn-sm" type="button" id="htShuffle">${icon('refresh')}Shuffle picks</button>
    </div>
    <p class="small muted" id="htPlatNote"></p>
    <div id="htOut" class="ht-out"></div>
    <div class="card ht-sel">
      <div class="row nogrow wrap" style="justify-content:space-between;align-items:center"><h2 class="small-h">${icon('hash')}Selected <span id="htCount" class="badge"></span></h2>
      <div class="row nogrow"><button class="btn btn-sm btn-ghost" type="button" id="htNone">Clear</button><button class="btn btn-sm btn-primary" type="button" id="htCopy" data-testid="ht-copy">${icon('copy')}Copy selected</button></div></div>
      <output id="htSel" class="ht-text" data-testid="ht-selected"></output>
      <p class="tiny" id="htWarn"></p>
    </div>
  </div>`;
  const inp = $('#htIn', panel), plat = $('#htPlat', panel), loc = $('#htLoc', panel), topic = $('#htTopic', panel), cam = $('#htCamel', panel);
  inp.value = typeof st.text === 'string' ? st.text : '';
  plat.value = PLATFORM_TAGS.some((p) => p.id === st.plat) ? st.plat : 'instagram';
  loc.value = typeof st.loc === 'string' ? st.loc : '';
  cam.checked = !!st.camel;
  let res = null, selected = [], shuffle = 0;
  const fmtTag = (t) => '#' + (cam.checked ? camel(t) : t);
  const P = () => PLATFORM_TAGS.find((p) => p.id === plat.value);

  function autoPick() {
    const p = P(); const n = p.max; const pick = [];
    const niche = [...res.keyword.slice(0, 4), ...res.niche]; const rot = niche.length ? shuffle % niche.length : 0;
    const ordered = [...niche.slice(rot), ...niche.slice(0, rot)];
    if (res.broad[0] && n >= 3) pick.push(res.broad[shuffle % Math.min(3, res.broad.length)]);
    for (const t of ordered) { if (pick.length >= n) break; if (!pick.includes(t)) pick.push(t); }
    for (const t of res.broad) { if (pick.length >= n) break; if (!pick.includes(t)) pick.push(t); }
    selected = pick;
  }
  function run(keepSel) {
    res = generate(inp.value, { topicIds: topic.value ? [topic.value] : [], location: loc.value });
    if (!keepSel) autoPick();
    draw();
  }
  function chipList(title, arr, kind) {
    if (!arr.length) return '';
    return `<div class="ht-group"><h3 class="tiny-h">${esc(title)}</h3><div class="chips">${arr.map((t) => `<button type="button" class="chip tag ${kind}${GENERIC.includes(t) ? ' generic' : ''}" aria-pressed="${selected.includes(t)}" data-t="${esc(t)}">${esc(fmtTag(t))}</button>`).join('')}</div></div>`;
  }
  function draw() {
    const p = P();
    $('#htPlatNote', panel).textContent = `${p.name}: use ${p.min === p.max ? p.min : `${p.min}–${p.max}`}. ${p.note}`;
    const out = $('#htOut', panel);
    if (!inp.value.trim() && !topic.value) out.innerHTML = '<p class="empty">Type a few keywords about your post, or pick a topic, to get suggestions.</p>';
    else out.innerHTML = (res.topics.length ? `<p class="tiny muted">Matched topics: ${res.topics.map((t) => esc(t.name)).join(', ')}</p>` : '<p class="tiny muted">No curated topic matched, so these come from your keywords only. Try picking a topic.</p>')
      + chipList('From your keywords (most specific)', res.keyword, 'kw') + chipList('Niche', res.niche, 'niche') + chipList('Broad (big, competitive)', res.broad, 'broad');
    $('#htSel', panel).textContent = selected.map(fmtTag).join(' ');
    const c = $('#htCount', panel); c.textContent = `${selected.length} / ${p.max}`; c.className = 'badge ' + (p.hard && selected.length > p.hard ? 'err' : selected.length > p.max ? 'warn' : selected.length ? 'ok' : '');
    const w = [];
    if (p.hard && selected.length > p.hard) w.push(`${p.name} allows at most ${p.hard}. Extra tags may be dropped or block posting.`);
    else if (selected.length > p.max) w.push(`More than the ${p.max} recommended for ${p.name}.`);
    const gen = selected.filter((t) => GENERIC.includes(t)); if (gen.length) w.push(`${gen.map((t) => '#' + t).join(', ')} ${gen.length > 1 ? 'are' : 'is'} too generic to help.`);
    $('#htWarn', panel).textContent = w.join(' ');
    $('#htWarn', panel).className = 'tiny ' + (w.length ? 'warn-t' : '');
    ls.set('ps-ht', { text: inp.value, plat: plat.value, loc: loc.value, camel: cam.checked });
  }
  const deb = debounce(() => run(false), 250);
  inp.addEventListener('input', deb); loc.addEventListener('input', deb);
  topic.addEventListener('change', () => run(false));
  plat.addEventListener('change', () => { autoPick(); draw(); });
  cam.addEventListener('change', draw);
  $('#htShuffle', panel).addEventListener('click', () => { shuffle++; autoPick(); draw(); });
  $('#htNone', panel).addEventListener('click', () => { selected = []; draw(); });
  $('#htOut', panel).addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t; const i = selected.indexOf(t); i >= 0 ? selected.splice(i, 1) : selected.push(t);
    draw(); $(`[data-t="${CSS.escape(t)}"]`, panel)?.focus();
  });
  $('#htCopy', panel).addEventListener('click', () => { if (!selected.length) return toast('Select some hashtags first'); copyText(selected.map(fmtTag).join(' '), `Copied ${selected.length} hashtags`); });
  run(false);
}
