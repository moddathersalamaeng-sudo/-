/**
 * Global search (Phase 10A). Pure functions shared by the build script (tools/build_phase10a.mjs, which writes
 * data/search-index.json) and the browser, so the index and the query are normalised by exactly the same code.
 *
 * Arabic normalisation: أ إ آ ٱ → ا · ة → ه · ى → ي · ؤ → و · ئ → ي · tatweel and diacritics removed ·
 * Arabic-Indic digits → 0-9. Latin text is lower-cased and accent-free. Numbers keep inner dots ("7.2").
 * © 2026 Modather Salama — Continual Improvement Academy.
 */
export const SEARCH_SCHEMA = 'cia.search-index.v1';
export const SEARCH_TYPES = ['course', 'lesson', 'guide', 'guide_item', 'certification', 'article', 'template', 'standard', 'lab'];
/** Higher = shown first when scores tie. */
const TYPE_WEIGHT = { course: 6, certification: 5, guide: 5, lab: 4, standard: 4, guide_item: 3, article: 3, lesson: 2, template: 2 };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeText(input) {
  let s = String(input ?? '');
  s = s.replace(/٫/g, '.').replace(/٬/g, ',');
  s = s.replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)));
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');           // Latin accents
  s = s.replace(/[ً-ٰٟۖ-ۭ]/g, '');            // Arabic diacritics (harakat, shadda, sukun, dagger alif, Quranic marks)
  s = s.replace(/ـ/g, '');                                        // tatweel
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  s = s.toLowerCase();
  s = s.replace(/(\d)[.,](?=\d)/g, '$1․');                         // protect 7.2 / 9,001 inside numbers
  s = s.replace(/[^\p{L}\p{N}․]+/gu, ' ').replace(/․/g, '.');
  return s.replace(/\s+/g, ' ').trim();
}

export const tokenize = s => normalizeText(s).split(' ').filter(Boolean);

/** Remove the Arabic definite article from a token so "الجودة" matches "جودة". */
const stem = tok => (tok.length > 4 && tok.startsWith('ال') ? tok.slice(2) : tok);

/**
 * One index entry. `title` and `sub` are {ar, en}; `extra` is a list of additional searchable strings
 * (codes, clause numbers, synonyms). `k` is the normalised keyword string the query runs against.
 */
export function makeEntry({ type, id, href, title, sub = null, academy = null, extra = [] }) {
  const ti = { ar: String(title?.ar || title?.en || ''), en: String(title?.en || title?.ar || '') };
  const su = sub ? { ar: String(sub.ar || sub.en || ''), en: String(sub.en || sub.ar || '') } : null;
  const nt = normalizeText(`${ti.ar} ${ti.en}`);
  const k = normalizeText([ti.ar, ti.en, su?.ar, su?.en, ...extra].filter(Boolean).join(' '));
  return { t: type, id, h: href, ti, ...(su ? { su } : {}), ...(academy ? { a: academy } : {}), nt, k };
}

const words = s => s.split(' ').map(stem);

/**
 * Rank entries for a query. Every query token that occurs anywhere in the index must match an entry (tokens that
 * match nothing in the whole index — e.g. "clause" — are ignored rather than emptying the results).
 * Scoring per token: whole word in title 6 · title word prefix 4 · inside title 3 · keyword word 2 · inside keywords 1;
 * whole query inside the title +6; then type weight, then shorter titles first.
 */
export function searchIndex(entries, query, { types = null, limit = 50, academy = null } = {}) {
  const qn = normalizeText(query);
  const qtoks = [...new Set(qn.split(' ').filter(Boolean).map(stem))];
  if (!qtoks.length) return [];
  const pool = entries.filter(e => (!types || types.includes(e.t)) && (!academy || e.a === academy));
  const known = qtoks.filter(tk => pool.some(e => e.k.includes(tk)));
  if (!known.length) return [];
  const out = [];
  for (const e of pool) {
    const tw = words(e.nt), kw = words(e.k);
    let score = 0, ok = true;
    for (const tk of known) {
      let s = 0;
      if (tw.includes(tk)) s = 6;
      else if (tw.some(w => w.startsWith(tk))) s = 4;
      else if (e.nt.includes(tk)) s = 3;
      else if (kw.includes(tk)) s = 2;
      else if (e.k.includes(tk)) s = 1;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    if (known.length > 1 && e.nt.includes(known.join(' '))) score += 6;
    out.push({ e, score });
  }
  out.sort((x, y) => y.score - x.score || (TYPE_WEIGHT[y.e.t] || 0) - (TYPE_WEIGHT[x.e.t] || 0) || x.e.nt.length - y.e.nt.length || String(x.e.id).localeCompare(String(y.e.id)));
  return out.slice(0, limit).map(x => ({ ...x.e, score: x.score }));
}

/** Results grouped by type, in a fixed order, for the results page. */
export function groupResults(results) {
  const order = ['course', 'lab', 'certification', 'guide', 'guide_item', 'standard', 'lesson', 'article', 'template'];
  const g = new Map(order.map(t => [t, []]));
  for (const r of results) (g.get(r.t) || g.set(r.t, []).get(r.t)).push(r);
  return [...g.entries()].filter(([, xs]) => xs.length);
}
