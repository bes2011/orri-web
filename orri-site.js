/* ORRI · one-page site — contours, scroll reveals, count-up, nav */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- continuous elevation field → non-crossing contours ---------------- */
  function makeField(seed) {
    var peaks = [
      { x: 900, y: 240, a: 100, sx: 360, sy: 280 },
      { x: 220, y: 600, a: 72, sx: 280, sy: 230 },
      { x: 620, y: 860, a: 82, sx: 520, sy: 260 },
      { x: 1120, y: 660, a: 46, sx: 320, sy: 250 }
    ];
    return function (x, y) {
      var h = 0;
      for (var i = 0; i < peaks.length; i++) {
        var p = peaks[i], dx = (x - p.x) / p.sx, dy = (y - p.y) / p.sy;
        h += p.a * Math.exp(-(dx * dx + dy * dy));
      }
      h += 7 * Math.sin(x / 150 + seed) * Math.cos(y / 130 - seed * 0.5) + 4 * Math.sin(x / 80 - y / 110 + seed);
      return h;
    };
  }

  function contourPaths(seed) {
    var x0 = -120, y0 = -120, x1 = 1320, y1 = 920, step = 26;
    var field = makeField(seed);
    var cols = Math.round((x1 - x0) / step), rows = Math.round((y1 - y0) / step);
    var gx = function (i) { return x0 + i * step; }, gy = function (j) { return y0 + j * step; };
    var V = [], mn = Infinity, mx = -Infinity, i, j;
    for (j = 0; j <= rows; j++) { V[j] = []; for (i = 0; i <= cols; i++) { var v = field(gx(i), gy(j)); V[j][i] = v; if (v < mn) mn = v; if (v > mx) mx = v; } }
    function interp(ax, ay, av, bx, by, bv, L) { var t = (L - av) / (bv - av); return [ax + t * (bx - ax), ay + t * (by - ay)]; }
    function segs(L) {
      var s = [];
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var tl = V[j][i], tr = V[j][i + 1], br = V[j + 1][i + 1], bl = V[j + 1][i];
        var X = gx(i), Y = gy(j), X2 = gx(i + 1), Y2 = gy(j + 1), cr = [];
        if ((tl > L) !== (tr > L)) cr.push(interp(X, Y, tl, X2, Y, tr, L));
        if ((tr > L) !== (br > L)) cr.push(interp(X2, Y, tr, X2, Y2, br, L));
        if ((bl > L) !== (br > L)) cr.push(interp(X, Y2, bl, X2, Y2, br, L));
        if ((tl > L) !== (bl > L)) cr.push(interp(X, Y, tl, X, Y2, bl, L));
        if (cr.length === 2) s.push([cr[0], cr[1]]);
        else if (cr.length === 4) { s.push([cr[0], cr[3]]); s.push([cr[1], cr[2]]); }
      }
      return s;
    }
    function chain(ss) {
      var K = function (p) { return Math.round(p[0]) + ',' + Math.round(p[1]); };
      var ends = {};
      ss.forEach(function (s, i) { s.forEach(function (p) { var k = K(p); (ends[k] = ends[k] || []).push(i); }); });
      var used = [], out = [];
      for (var i = 0; i < ss.length; i++) {
        if (used[i]) continue; used[i] = 1;
        var ch = [ss[i][0], ss[i][1]];
        for (var dir = 0; dir < 2; dir++) {
          var go = 1;
          while (go) {
            go = 0;
            var end = dir === 0 ? ch[ch.length - 1] : ch[0];
            var k = K(end), cand = ends[k] || [];
            for (var c = 0; c < cand.length; c++) {
              var jj = cand[c]; if (used[jj]) continue;
              var s = ss[jj], nxt = null;
              if (K(s[0]) === k) nxt = s[1]; else if (K(s[1]) === k) nxt = s[0];
              if (nxt) { used[jj] = 1; if (dir === 0) ch.push(nxt); else ch.unshift(nxt); go = 1; break; }
            }
          }
        }
        out.push(ch);
      }
      return out;
    }
    var nL = 8, paths = [];
    for (var l = 0; l < nL; l++) {
      var L = mn + (mx - mn) * (l + 0.5) / nL;
      var polys = chain(segs(L)), idx = (l % 3 === 0);
      for (var p = 0; p < polys.length; p++) {
        var ch = polys[p]; if (ch.length < 3) continue;
        var d = 'M' + ch.map(function (pt) { return Math.round(pt[0]) + ',' + Math.round(pt[1]); }).join(' L');
        paths.push({ d: d, idx: idx });
      }
    }
    return paths;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function buildContours(container) {
    var seed = parseFloat(container.getAttribute('data-seed') || '1.2');
    var paths = contourPaths(seed);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 1200 800');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('class', 'contour-svg');
    var frag = document.createDocumentFragment(), els = [];
    paths.forEach(function (pp) {
      var pa = document.createElementNS(SVGNS, 'path');
      pa.setAttribute('d', pp.d);
      pa.setAttribute('class', 'cline' + (pp.idx ? ' idx' : ''));
      frag.appendChild(pa); els.push(pa);
    });
    svg.appendChild(frag);
    container.appendChild(svg);
    return els;
  }
  function drawPaths(els, dur, stagger) {
    els.forEach(function (pa, i) {
      var len = pa.getTotalLength();
      pa.style.strokeDasharray = len;
      if (REDUCE) { pa.style.strokeDashoffset = '0'; return; }
      pa.style.strokeDashoffset = len;
      pa.getBoundingClientRect();
      pa.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.4,.0,.2,1) ' + (i * stagger) + 'ms';
      pa.style.strokeDashoffset = '0';
    });
  }

  function buildAndDraw(c) { if (c.__built) return; c.__built = true; var els = buildContours(c); requestAnimationFrame(function () { drawPaths(els, 1700, 14); }); }
  function revealEl(el) { if (el.__in) return; el.__in = true; el.classList.add('in'); var marks = el.querySelectorAll('.pmark path'); if (marks.length) drawPaths([].slice.call(marks), 1100, 90); }
  function finishCount(el) { var sec = el.closest ? el.closest('section') : null; (sec || document).querySelectorAll('[data-after-count]').forEach(revealEl); }
  function runCount(el) {
    if (el.__done) return; el.__done = true;
    var target = parseFloat(el.getAttribute('data-count')), dur = 1700, start = null;
    if (REDUCE) { el.textContent = target.toLocaleString('de-DE'); finishCount(el); return; }
    function stepf(ts) { if (!start) start = ts; var p = Math.min((ts - start) / dur, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(e * target).toLocaleString('de-DE'); if (p < 1) requestAnimationFrame(stepf); else finishCount(el); }
    requestAnimationFrame(stepf);
  }
  function showAll() {
    document.querySelectorAll('[data-contours]').forEach(buildAndDraw);
    document.querySelectorAll('.reveal').forEach(revealEl);
    document.querySelectorAll('[data-count]').forEach(runCount);
  }
  window.__orriShowAll = showAll;

  if ('IntersectionObserver' in window) {
    var cObs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { buildAndDraw(e.target); cObs.unobserve(e.target); } }); }, { threshold: 0.04, rootMargin: '0px 0px 12% 0px' });
    document.querySelectorAll('[data-contours]').forEach(function (c) { cObs.observe(c); });
    var rObs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (!e.target.hasAttribute('data-after-count')) revealEl(e.target); rObs.unobserve(e.target); } }); }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { rObs.observe(el); });
    var nObs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); nObs.unobserve(e.target); } }); }, { threshold: 0.45 });
    document.querySelectorAll('[data-count]').forEach(function (el) { nObs.observe(el); });
  } else {
    showAll();
  }

  /* nav: solid after hero */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > window.innerHeight * 0.72) nav.classList.add('solid');
    else nav.classList.remove('solid');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* hero in immediately */
  window.addEventListener('DOMContentLoaded', function () {
    var h = document.querySelector('.hero .reveal');
    if (h) h.classList.add('in');
  });
})();
