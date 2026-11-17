/* Apex Clan League: leaderboard poster renderer.
   Pure canvas drawing (no DOM), so the same code makes the PNG, the animated GIF and the PDF.
   draw(ctx, data, t) draws the poster at animation progress t (0 to 1). t = 1 is the finished poster. */
(function (root) {
  'use strict';
  var W = 1080, M = 48, CY = '#0ff5d4';
  var TAB = [['#0ff5d4', '#0f3a35'], ['#3a8dff', '#101c33'], ['#a24bff', '#1a1233'], ['#8aa0b4', '#141b22']];
  var ACC = { 1: '#ffc94d', 2: '#0ff5d4', 3: '#d98a4e' };
  var MONO = '"IBM Plex Mono", monospace', DISP = '"Tektur", sans-serif';

  var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
  var prog = function (t, a, d) { return clamp((t - a) / d); };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  var easeBack = function (x) { var c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  function layout(data) {
    var n = data.rows.length, start = data.start || 0, pod = start > 0 ? 0 : Math.min(3, n), rest = Math.max(0, n - pod);
    var podTop = 262, podBottom = podTop + (pod ? 500 : 0);
    var rowsTop = podBottom + (rest ? 74 : 0);
    var H = rowsTop + rest * 84 + (rest ? 18 : 0) + 100;
    return { n: n, start: start, pod: pod, rest: rest, podTop: podTop, podBottom: podBottom, rowsTop: rowsTop, H: H };
  }

  function chamfer(ctx, x, y, w, h, c) { // c: [tl, tr, br, bl] cut sizes
    c = c || [0, 0, 0, 0];
    ctx.beginPath();
    ctx.moveTo(x + c[0], y);
    ctx.lineTo(x + w - c[1], y);
    if (c[1]) ctx.lineTo(x + w, y + c[1]);
    ctx.lineTo(x + w, y + h - c[2]);
    if (c[2]) ctx.lineTo(x + w - c[2], y + h);
    ctx.lineTo(x + c[3], y + h);
    if (c[3]) ctx.lineTo(x, y + h - c[3]);
    ctx.lineTo(x, y + c[0]);
    ctx.closePath();
  }

  function fit(ctx, text, weight, family, maxW, start, min) {
    var s = start;
    ctx.font = weight + ' ' + s + 'px ' + family;
    while (ctx.measureText(text).width > maxW && s > min) { s -= 2; ctx.font = weight + ' ' + s + 'px ' + family; }
    return s;
  }

  function img(ctx, im, x, y, w, h) { if (im) { try { ctx.drawImage(im, x, y, w, h); } catch (e) { /* skip broken image */ } } }
  function imgFit(ctx, im, cx, cy, box) {
    if (!im) return;
    var r = Math.min(box / im.width, box / im.height);
    img(ctx, im, cx - im.width * r / 2, cy - im.height * r / 2, im.width * r, im.height * r);
  }

  function shield(ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(12, 2); ctx.lineTo(4, 5); ctx.lineTo(4, 11); ctx.bezierCurveTo(4, 16, 7.4, 20.3, 12, 22); ctx.bezierCurveTo(16.6, 20.3, 20, 16, 20, 11); ctx.lineTo(20, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function titleIcons(ctx, data, keys, x, y, size, gap, alpha) {
    var k = (keys || []).slice(0, 7);
    for (var i = 0; i < k.length; i++) {
      var im = data.img.tp[k[i]], tx = x + i * (size + gap);
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.fillStyle = '#222'; chamfer(ctx, tx, y, size, size, [0, 0, 0, 0]); ctx.fill();
      img(ctx, im, tx, y, size, size);
      ctx.restore();
    }
  }

  function background(ctx, data, L, t) {
    var H = L.H;
    ctx.fillStyle = '#060b11'; ctx.fillRect(0, 0, W, H);
    var bg = data.img.bg;
    if (bg) {
      var r = Math.max(W / bg.width, H / bg.height), bw = bg.width * r, bh = bg.height * r;
      ctx.globalAlpha = 0.9; img(ctx, bg, (W - bw) / 2, 0, bw, bh); ctx.globalAlpha = 1;
    }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(5,11,17,0.62)'); g.addColorStop(0.45, 'rgba(5,11,17,0.78)'); g.addColorStop(1, 'rgba(5,11,17,0.94)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W / 2, L.podTop + 260, 40, W / 2, L.podTop + 260, 620);
    rg.addColorStop(0, 'rgba(15,245,212,0.16)'); rg.addColorStop(1, 'rgba(15,245,212,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  function header(ctx, data, L, t) {
    var p = easeOut(prog(t, 0, 0.14));
    ctx.save(); ctx.globalAlpha = p; ctx.translate(0, (1 - p) * -34);
    img(ctx, data.img.logo, M, 44, 120, 120);
    var tx = M + 140;
    ctx.shadowColor = 'rgba(15,245,212,0.55)'; ctx.shadowBlur = 26;
    ctx.fillStyle = '#1fd6b4';
    var s = fit(ctx, data.title, '900', DISP, W - tx - M, 68, 36);
    ctx.textBaseline = 'alphabetic'; ctx.fillText(data.title, tx, 108);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9fc7bf'; ctx.font = '500 22px ' + MONO; ctx.fillText(data.sub, tx, 148);
    ctx.fillStyle = CY; fit(ctx, data.season, '700', DISP, W - tx - M - 330, 30, 18); ctx.fillText(data.season, tx, 192);
    // CWL day progress
    if (data.day) {
      var bx = W - M - 250, by = 160;
      ctx.fillStyle = '#9fc7bf'; ctx.font = '600 18px ' + MONO; ctx.textAlign = 'right';
      ctx.fillText('DAY ' + data.day + ' OF 7', W - M, by - 14); ctx.textAlign = 'left';
      for (var i = 0; i < 7; i++) {
        ctx.fillStyle = i < data.day ? (i === data.day - 1 ? '#ffffff' : CY) : 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.moveTo(bx + i * 36 + 6, by); ctx.lineTo(bx + i * 36 + 32, by); ctx.lineTo(bx + i * 36 + 26, by + 10); ctx.lineTo(bx + i * 36, by + 10); ctx.closePath(); ctx.fill();
      }
    }
    // underline
    ctx.fillStyle = 'rgba(15,245,212,0.5)'; ctx.fillRect(M, 226, (W - 2 * M) * p, 2);
    ctx.restore();
  }

  function podium(ctx, data, L, t) {
    var cw = 312, gap = 24, order = [1, 0, 2].filter(function (i) { return i < L.pod; }), hs = [490, 430, 400];
    var start = [0.12, 0.06, 0.18];
    order.forEach(function (i, idx) {
      var r = data.rows[i], x = M + (i === 0 ? 1 : i === 1 ? 0 : 2) * (cw + gap), h = hs[i];
      var p = prog(t, start[i], 0.3), pe = easeBack(p);
      if (p <= 0) return;
      var y = L.podBottom - h + (1 - Math.min(1, pe)) * 140;
      ctx.save(); ctx.globalAlpha = clamp(p * 2.2);
      ctx.translate(x, y);
      // card
      var g = ctx.createRadialGradient(cw / 2, h * 0.45, 20, cw / 2, h * 0.45, 330);
      g.addColorStop(0, '#17504a'); g.addColorStop(0.6, '#123b36'); g.addColorStop(1, '#0c2c29');
      ctx.fillStyle = g; chamfer(ctx, 0, 0, cw, h, [0, 0, 72, 0]); ctx.fill();
      ctx.save(); chamfer(ctx, 0, 0, cw, h, [0, 0, 72, 0]); ctx.clip();
      ctx.fillStyle = ACC[i + 1];
      ctx.beginPath(); ctx.moveTo(cw * 0.55, 0); ctx.lineTo(cw, 0); ctx.lineTo(cw, cw * 0.45); ctx.closePath(); ctx.fill();
      ctx.restore();
      // rank
      ctx.fillStyle = '#fff'; ctx.font = '900 104px ' + DISP; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(i + 1), 22, 108);
      // league badge
      var lgi = r.lg || (r.lgUrl ? null : data.img.bd);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      imgFit(ctx, lgi, cw - 50, 46, 66); ctx.restore();
      // town hall
      imgFit(ctx, data.img.th[Math.max(11, Math.min(18, r.th))], cw / 2, h * 0.41, 196);
      // name
      ctx.fillStyle = '#fff'; fit(ctx, r.name, '700', MONO, cw - 44, 44, 18); ctx.fillText(r.name, 22, h - 138);
      // clan
      if (r.clanImg) imgFit(ctx, r.clanImg, 34, h - 112, 24); else shield(ctx, 22, h - 124, 24, '#9fb4b0');
      ctx.fillStyle = '#d9ece8'; fit(ctx, String(r.clan).toUpperCase(), '700', MONO, cw - 90, 17, 11); ctx.fillText(String(r.clan).toUpperCase(), 54, h - 106);
      // score (counts up)
      var sp = easeOut(prog(t, start[i] + 0.2, 0.3)), sc = r.score * sp;
      ctx.fillStyle = '#fff'; ctx.font = '700 52px ' + MONO; var sw = ctx.measureText(sc.toFixed(1)).width; ctx.fillText(sc.toFixed(1), 22, h - 60);
      ctx.fillStyle = '#9fc7bf'; ctx.font = '700 20px ' + MONO; ctx.fillText('pts', 22 + sw + 8, h - 60);
      // titles
      titleIcons(ctx, data, r.titles, 22, h - 46, 32, 6, 1);
      ctx.restore();
    });
  }

  function rows(ctx, data, L, t) {
    var rw = W - 2 * M, label = L.rest ? (L.start > 0 ? 'RANKS' : 'THE CHASE') : '';
    var lp = easeOut(prog(t, 0.34, 0.12));
    if (L.rest) {
      ctx.save(); ctx.globalAlpha = lp; ctx.fillStyle = CY; ctx.font = '900 26px ' + DISP; ctx.fillText(label, M, L.rowsTop - 30);
      ctx.fillStyle = 'rgba(159,180,176,0.9)'; ctx.font = '500 18px ' + MONO; ctx.fillText((L.start + L.pod + 1) + ' \u2014 ' + (L.start + data.rows.length), M + (L.start > 0 ? 130 : 180), L.rowsTop - 31);
      var lx = L.start > 0 ? 210 : 260, lg = ctx.createLinearGradient(M + lx, 0, W - M, 0); lg.addColorStop(0, CY); lg.addColorStop(1, 'rgba(15,245,212,0)');
      ctx.fillStyle = lg; ctx.fillRect(M + lx + 10, L.rowsTop - 36, rw - lx - 10, 2); ctx.restore();
    }
    var stg = Math.min(0.032, 0.28 / Math.max(1, L.rest - 1));
    for (var j = L.pod; j < data.rows.length; j++) {
      var r = data.rows[j], k = j - L.pod, aj = L.start + j, p = prog(t, 0.4 + k * stg, 0.16), pe = easeOut(p);
      if (p <= 0) continue;
      var y = L.rowsTop + k * 84, th = TAB[Math.min(3, Math.floor((aj) / 10))] || TAB[0];
      if (aj < 10) th = TAB[0];
      ctx.save(); ctx.globalAlpha = pe; ctx.translate((1 - pe) * -240, 0);
      // rank tab
      ctx.fillStyle = th[0]; ctx.fillRect(M, y, 96, 74);
      ctx.fillStyle = '#04221e'; ctx.font = '700 30px ' + DISP; ctx.textAlign = 'center';
      var rk = aj + 1, ord = rk + (rk % 100 >= 11 && rk % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][rk % 10 < 4 ? rk % 10 : 0]);
      ctx.fillText(ord, M + 48, y + 47); ctx.textAlign = 'left';
      // bar
      ctx.fillStyle = th[1]; chamfer(ctx, M + 96, y, rw - 96, 74, [0, 0, 16, 0]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; chamfer(ctx, M + 96, y, rw - 96, 74, [0, 0, 16, 0]); ctx.stroke();
      var bx = M + 96;
      imgFit(ctx, data.img.th[Math.max(11, Math.min(18, r.th))], bx + 42, y + 37, 54);
      ctx.fillStyle = '#fff'; fit(ctx, r.name, '700', MONO, 330, 30, 16); ctx.fillText(r.name, bx + 82, y + 34);
      ctx.fillStyle = '#9fb4b0'; fit(ctx, String(r.clan).toUpperCase(), '500', MONO, 300, 16, 10); ctx.fillText(String(r.clan).toUpperCase(), bx + 82, y + 58);
      titleIcons(ctx, data, (r.titles || []).slice(0, 5), bx + 390, y + 20, 34, 6, 1);
      ctx.fillStyle = '#9fb4b0'; ctx.font = '500 13px ' + MONO; ctx.fillText('ATK', bx + 628, y + 28);
      ctx.fillStyle = '#e6f3f8'; ctx.font = '700 24px ' + MONO; ctx.fillText(r.used + '/' + r.avail, bx + 628, y + 56);
      // slanted score box
      var sx = M + rw - 176, sy = y + 12, sw = 150, sh = 50, sk = 14;
      ctx.beginPath(); ctx.moveTo(sx + sk, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw - sk, sy + sh); ctx.lineTo(sx, sy + sh); ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.strokeStyle = th[0]; ctx.lineWidth = 2; ctx.stroke();
      var sp = easeOut(prog(t, 0.46 + k * stg, 0.25)), sc = r.score * sp;
      ctx.fillStyle = '#fff'; ctx.font = '700 32px ' + MONO; ctx.textAlign = 'center'; ctx.fillText(sc.toFixed(1), sx + sw / 2, sy + 36); ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function footer(ctx, data, L, t) {
    var y = L.H - 120, p = easeOut(prog(t, 0.7, 0.2));
    ctx.save(); ctx.globalAlpha = p;
    ctx.fillStyle = '#9fb4b0'; ctx.font = '500 18px ' + MONO; ctx.textAlign = 'center';
    ctx.fillText(data.foot, W / 2, L.H - 60); ctx.textAlign = 'left';
    ctx.restore();
  }

  function sweep(ctx, L, t) {
    var p = prog(t, 0.84, 0.14); if (p <= 0 || p >= 1) return;
    var x = -300 + p * (W + 600);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
    g.addColorStop(0, 'rgba(15,245,212,0)'); g.addColorStop(0.5, 'rgba(15,245,212,0.13)'); g.addColorStop(1, 'rgba(15,245,212,0)');
    ctx.fillStyle = g; ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.fillRect(x - 160 + L.H * 0.17, 0, 320, L.H);
    ctx.restore();
  }

  function draw(ctx, data, t) {
    var L = layout(data);
    background(ctx, data, L, t);
    header(ctx, data, L, t);
    podium(ctx, data, L, t);
    rows(ctx, data, L, t);
    footer(ctx, data, L, t);
    sweep(ctx, L, t);
    return L;
  }

  // ---- PDF: one page holding the poster as a JPEG
  function makePdf(jpeg, w, h) {
    var enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    var parts = [], off = 0, offs = [];
    var push = function (b) { parts.push(b); off += b.length; };
    var pw = Math.round(w * 0.75), ph = Math.round(h * 0.75);
    var obj = function (n, body) { offs[n] = off; push(enc(n + ' 0 obj\n')); push(typeof body === 'string' ? enc(body) : body); push(enc('\nendobj\n')); };
    push(enc('%PDF-1.4\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
    var cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(4, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    offs[5] = off;
    push(enc('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'));
    push(jpeg); push(enc('\nendstream\nendobj\n'));
    var x = off;
    var xr = 'xref\n0 6\n0000000000 65535 f \n';
    for (var n = 1; n <= 5; n++) xr += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
    push(enc(xr + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF'));
    var out = new Uint8Array(off), p = 0;
    parts.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  root.ApexExport = { W: W, layout: layout, draw: draw, makePdf: makePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ApexExport;
})(typeof window !== 'undefined' ? window : globalThis);
