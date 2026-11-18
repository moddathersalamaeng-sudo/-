/* Phase 14 (CSP): moved from an inline script in index.html — applies the platform-wide language before first paint. */
  /* Apply the platform-wide language (shared `cia-lang` key) before first paint. */
  (function () {
    var l = new URLSearchParams(location.search).get('lang');
    try { if (l !== 'ar' && l !== 'en') l = localStorage.getItem('cia-lang'); } catch (e) {}
    if (l !== 'ar' && l !== 'en') l = 'ar';
    document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  })();
