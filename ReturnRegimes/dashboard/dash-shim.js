// Minimal stand-in for the dashboard runtime, so the page runs as a plain
// static site. Data comes from data.js (window.DASH_DATA: dataset id -> CSV text).
(function () {
  const files = {};
  for (const [id, text] of Object.entries(window.DASH_DATA || {})) {
    const rows = d3.csvParse(text.trim());
    files[id] = { rows, columns: rows.columns };
  }
  const calcs = {}, cache = {}, subs = [];
  let params = Object.assign({}, window.DASH_PARAMS || {});
  const defaults = Object.assign({}, params);
  function rowsOf(id) {
    if (files[id]) return files[id].rows;
    if (!(id in cache)) { const c = calcs[id]; cache[id] = c.fn(...c.inputs.map(rowsOf)); }
    return cache[id];
  }
  function run() { for (const fn of subs) { try { fn(); } catch (e) { console.error(e); } } }
  window.dash = {
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
             'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'],
    data(id) {
      if (!files[id] && !calcs[id]) return { status: 'missing', data: [], meta: [] };
      try { return { status: 'ok', data: rowsOf(id), columns: files[id] ? files[id].columns : undefined, meta: [] }; }
      catch (e) { console.error(e); return { status: 'error', data: [], message: String(e), meta: [] }; }
    },
    calc(id, def) { calcs[id] = def; },
    loader() {},
    onData(fn) { subs.push(fn); },
    params() { return Object.assign({}, params); },
    setParams(p) { params = Object.assign({}, params, p); run(); },
    resetParams() { params = Object.assign({}, defaults); run(); },
    refresh() {}, setLink() {},
  };
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('dash-root');
    let w = root.clientWidth;
    run();
    new ResizeObserver(() => { if (root.clientWidth !== w) { w = root.clientWidth; run(); } }).observe(root);
  });
})();
