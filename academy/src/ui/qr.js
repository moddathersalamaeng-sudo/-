/**
 * QR code as crisp SVG (one path), from the vendored qrcode-generator (MIT). Error correction M; the quiet zone is part
 * of the drawing so a printed or phone-screen code scans without any margin around it.
 */
import qrcode from '../vendor/qrcode.mjs';
const NS = 'http://www.w3.org/2000/svg';

export function qrMatrix(text, ecc = 'M') {
  const q = qrcode(0, ecc); q.addData(String(text)); q.make();
  const n = q.getModuleCount(), m = [];
  for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
  return m;
}

export function qrSvg(text, { label = '', fg = '#0E2A47', bg = '#FFFFFF', quiet = 4 } = {}) {
  const m = qrMatrix(text), n = m.length, size = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (!m[r][c]) { c++; continue; } let e = c; while (e < n && m[r][e]) e++; d += `M${c + quiet} ${r + quiet}h${e - c}v1h${c - e}z`; c = e; } }
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('class', 'qr-svg'); svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img'); if (label) svg.setAttribute('aria-label', label);
  const bgr = document.createElementNS(NS, 'rect'); bgr.setAttribute('width', size); bgr.setAttribute('height', size); bgr.setAttribute('fill', bg);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', fg);
  svg.append(bgr, p); svg.dataset.modules = String(n);
  return svg;
}
