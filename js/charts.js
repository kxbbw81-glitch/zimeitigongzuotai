/* ============================================================
   社媒工作台 · 轻量 SVG 图表（无外部依赖）
   ============================================================ */
(function () {
  const MW = (window.MW = window.MW || {});
  const C = {
    line: '#e7e9f2', text3: '#9aa0b4',
    primary: '#4f46e5', teal: '#0ea5a4', amber: '#f59e0b',
    red: '#e5484d', green: '#18a058', blue: '#2f6fed', purple: '#8b5cf6'
  };
  MW.CHART_COLORS = C;

  function fmtK(v) {
    v = +v || 0;
    if (v >= 10000) return (v / 10000).toFixed(1).replace('.0', '') + 'w';
    if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(Math.round(v));
  }
  function niceMax(v) {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }

  const charts = {};

  /* ---------- 折线图 ---------- */
  charts.line = function (opt) {
    const W = 640, H = opt.height || 210, L = 44, R = 14, T = 12, B = 26;
    const labels = opt.labels || [];
    const series = opt.series || [];
    const all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { all.push(+v || 0); }); });
    const max = niceMax(Math.max.apply(null, all.concat([1])));
    const iw = W - L - R, ih = H - T - B;
    const n = labels.length;
    const x = function (i) { return n <= 1 ? L + iw / 2 : L + i * iw / (n - 1); };
    const y = function (v) { return T + ih - ((+v || 0) / max) * ih; };
    let g = '';
    for (let t = 0; t <= 2; t++) {
      const v = max * t / 2, yy = y(v);
      g += '<line x1="' + L + '" y1="' + yy + '" x2="' + (W - R) + '" y2="' + yy + '" stroke="' + C.line + '"/>';
      g += '<text x="' + (L - 7) + '" y="' + (yy + 3.5) + '" text-anchor="end" font-size="10" fill="' + C.text3 + '">' + fmtK(v) + '</text>';
    }
    const step = Math.max(1, Math.ceil(n / 8));
    labels.forEach(function (lb, i) {
      if (i % step === 0 || i === n - 1) {
        g += '<text x="' + x(i) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="' + C.text3 + '">' + lb + '</text>';
      }
    });
    series.forEach(function (s) {
      const pts = s.values.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
      s.values.forEach(function (v, i) {
        g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="2.6" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>';
      });
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block">' + g + '</svg>';
  };

  /* ---------- 分组柱状图 ---------- */
  charts.bar = function (opt) {
    const W = 640, H = opt.height || 210, L = 44, R = 14, T = 12, B = 26;
    const labels = opt.labels || [];
    const series = opt.series || [];
    const all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { all.push(+v || 0); }); });
    const max = niceMax(Math.max.apply(null, all.concat([1])));
    const iw = W - L - R, ih = H - T - B;
    const n = labels.length;
    const gw = iw / Math.max(n, 1);
    const bw = Math.min(16, (gw - 8) / Math.max(series.length, 1) - 2);
    const y = function (v) { return T + ih - ((+v || 0) / max) * ih; };
    let g = '';
    for (let t = 0; t <= 2; t++) {
      const v = max * t / 2, yy = y(v);
      g += '<line x1="' + L + '" y1="' + yy + '" x2="' + (W - R) + '" y2="' + yy + '" stroke="' + C.line + '"/>';
      g += '<text x="' + (L - 7) + '" y="' + (yy + 3.5) + '" text-anchor="end" font-size="10" fill="' + C.text3 + '">' + fmtK(v) + '</text>';
    }
    labels.forEach(function (lb, i) {
      const gx = L + i * gw;
      series.forEach(function (s, si) {
        const v = +s.values[i] || 0;
        const bx = gx + (gw - bw * series.length - 2 * (series.length - 1)) / 2 + si * (bw + 2);
        g += '<rect x="' + bx + '" y="' + y(v) + '" width="' + bw + '" height="' + (T + ih - y(v)) + '" rx="2.5" fill="' + s.color + '"/>';
      });
      g += '<text x="' + (gx + gw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="' + C.text3 + '">' + lb + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block">' + g + '</svg>';
  };

  /* ---------- 环形图 ---------- */
  charts.donut = function (data, opt) {
    opt = opt || {};
    const total = data.reduce(function (s, d) { return s + (+d.value || 0); }, 0);
    const R = 52, SW = 16, size = (R + SW / 2 + 4) * 2;
    const cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * R;
    let g = '', acc = 0;
    data.forEach(function (d) {
      const frac = total ? (+d.value || 0) / total : 0;
      const len = Math.max(0, frac * circ - 2);
      g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + d.color + '" stroke-width="' + SW +
        '" stroke-dasharray="' + len + ' ' + (circ - len) + '" stroke-dashoffset="' + (-acc * circ) +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      acc += frac;
    });
    g += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">' + (opt.center || fmtK(total)) + '</text>';
    g += '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" font-size="10" fill="' + C.text3 + '">' + (opt.centerLabel || '合计') + '</text>';
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + (opt.size || 150) + '" height="' + (opt.size || 150) + '">' + g + '</svg>';
  };

  /* ---------- 迷你走势 ---------- */
  charts.sparkline = function (values, color, w, h) {
    w = w || 92; h = h || 30;
    const vs = values.map(function (v) { return +v || 0; });
    const min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
    const span = max - min || 1;
    const pts = vs.map(function (v, i) {
      return (i / Math.max(vs.length - 1, 1) * (w - 6) + 3) + ',' + (h - 4 - (v - min) / span * (h - 8));
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="display:block">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + (color || C.primary) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  };

  /* ---------- 进度环 ---------- */
  charts.ring = function (pct, color, size, stroke, label) {
    size = size || 92; stroke = stroke || 9;
    const r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    pct = Math.max(0, Math.min(100, pct));
    const dash = pct / 100 * circ;
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + (circ - dash) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
      (label ? '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">' + label + '</text>' : '') +
      '</svg>';
  };

  MW.charts = charts;
})();
