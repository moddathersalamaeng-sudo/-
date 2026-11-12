/**
 * i18n service. Arabic (RTL) is the default locale; English is secondary (decision 0.5).
 * The platform-wide shared key `cia-lang` (used by the hub and all 17 toolkits) is the
 * single source of truth for the chosen language, so the Academy and the existing
 * platform always agree.
 */
import { Emitter } from './events.js';

export const LOCALES = {
  ar: { dir: 'rtl', bcp47: 'ar-SA', label: 'العربية' },
  en: { dir: 'ltr', bcp47: 'en-GB', label: 'English' }
};
export const DEFAULT_LOCALE = 'ar';
export const SHARED_LANG_KEY = 'cia-lang';

export function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

export function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Resolve the start-up locale: ?lang= → shared cia-lang → default. */
export function resolveInitialLocale({ search = '', storage = null } = {}) {
  const q = new URLSearchParams(search).get('lang');
  if (q && q in LOCALES) return q;
  try { const s = storage?.getItem(SHARED_LANG_KEY); if (s && s in LOCALES) return s; } catch { /* storage blocked */ }
  return DEFAULT_LOCALE;
}

/** Build an Intl locale tag that always uses the Gregorian calendar and the chosen digit system. */
export function intlTag(locale, digits) {
  const base = LOCALES[locale]?.bcp47 || 'en-GB';
  const nu = digits === 'arab' ? 'arab' : 'latn';
  return `${base}-u-ca-gregory-nu-${nu}`;
}

export class I18n extends Emitter {
  constructor({ dictionaries, locale = DEFAULT_LOCALE, digits = 'latn', onMissing = null }) {
    super();
    this.dicts = dictionaries;
    this.locale = locale in LOCALES ? locale : DEFAULT_LOCALE;
    this.digits = digits;
    this.onMissing = onMissing;
  }
  get dir() { return LOCALES[this.locale].dir; }
  t(key, params) {
    let v = lookup(this.dicts[this.locale], key);
    if (typeof v !== 'string') {
      this.onMissing?.(key, this.locale);
      v = lookup(this.dicts[DEFAULT_LOCALE], key);
      if (typeof v !== 'string') return key;
    }
    return interpolate(v, params);
  }
  has(key) { return typeof lookup(this.dicts[this.locale], key) === 'string'; }
  setLocale(locale) {
    if (!(locale in LOCALES) || locale === this.locale) return;
    this.locale = locale; this.emit('change', { locale });
  }
  setDigits(d) { if (d !== this.digits) { this.digits = d === 'arab' ? 'arab' : 'latn'; this.emit('change', { digits: this.digits }); } }
  number(n, opts) { return new Intl.NumberFormat(intlTag(this.locale, this.digits), opts).format(n); }
  list(items) { return new Intl.ListFormat(LOCALES[this.locale].bcp47, { type: 'conjunction' }).format(items.map(String)); }
  /** Render any Western digits inside a string with the chosen digit system (e.g. "12A"). */
  digitize(s) { return this.digits === 'arab' ? String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : String(s); }
  percent(ratio) { return this.number(ratio, { style: 'percent', maximumFractionDigits: 0 }); }
  /**
   * A calendar date ("2026-11-06") is a day, not an instant: it is read as UTC midnight and formatted in UTC, so it shows
   * the same day in every time zone (Phase 10A fix — west of UTC it used to show one day earlier). Timestamps keep the
   * viewer's local time zone.
   */
  date(value, opts = { year: 'numeric', month: 'long', day: 'numeric' }) {
    const dayOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = value instanceof Date ? value : new Date(dayOnly ? value + 'T00:00:00Z' : value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(intlTag(this.locale, this.digits), dayOnly ? { ...opts, timeZone: 'UTC' } : opts).format(d);
  }
}

/** Flatten a dictionary to dotted keys — used by the key-parity test. */
export function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flattenKeys(v, prefix + k + '.') : [prefix + k]);
}
