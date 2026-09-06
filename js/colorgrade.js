/* ============================================================
   Быстросайт — professional-look photo grading (canvas pixel pipeline).
   Applied client-side to every uploaded slot photo when the
   "Применить цветокоррекцию" toggle in /new-listing is on (js/app.js).
   Matte film look: lifted blacks, compressed whites, muted-but-vibrant
   color, warm white balance, teal-shadow/orange-highlight split tone,
   soft vignette, and a local-contrast (clarity) pass. Pure canvas —
   no server round-trip, matching the rest of the upload pipeline.
   ============================================================ */

window.BSColorGrade = (function () {
  'use strict';

  // ---- Tunables (midpoints of the requested ranges) ----
  var EXPOSURE_EV = -0.4;         // -0.3..-0.5 stops
  var BLACK_LIFT = 0.065;         // +5..8%
  var WHITE_LOWER = 0.065;        // -5..8%
  var SAT_GLOBAL = -0.175;        // -15..-20%
  var VIBRANCE = 0.065;           // +5..8%, weighted toward muted pixels
  var TEMP_SHIFT = 4;              // ~+250K warm, approximated in 0-255 units (R+, B-)
  var TINT_SHIFT = 2;              // +2..3% magenta (R+, B+, G-2x)
  var SPLIT_TONE_STRENGTH = 8;    // ~10% intensity, in 0-255 units
  var VIGNETTE_AMOUNT = 0.08;     // -5..-10%
  var CLARITY_AMOUNT = 0.13;      // +10..15%

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function smoothstep(edge0, edge1, x) {
    var t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  /* ---- HSL round-trip (0-1 s/l, 0-360 h) — used for selective color,
     vibrance and global saturation in one pass. ---- */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = 60 * (((g - b) / d) % 6); break;
        case g: h = 60 * ((b - r) / d + 2); break;
        default: h = 60 * ((r - g) / d + 4);
      }
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  /* ---- Exposure + white balance + tone curve, folded into one
     256-entry lookup per channel (constant per image, O(1) per pixel). ---- */
  function buildChannelLUT(wbShift) {
    var lut = new Uint8ClampedArray(256);
    var expFactor = Math.pow(2, EXPOSURE_EV);
    var bp = BLACK_LIFT, wp = 1 - WHITE_LOWER;
    for (var i = 0; i < 256; i++) {
      var v = clamp01((i / 255) * expFactor + wbShift / 255);
      var s = v * v * (3 - 2 * v); // smoothstep
      var soft = v + (s - v) * 0.35; // soft S-curve, not full smoothstep
      lut[i] = Math.round(clamp01(bp + soft * (wp - bp)) * 255);
    }
    return lut;
  }

  function gradeImageData(imageData) {
    var data = imageData.data;
    var w = imageData.width, h = imageData.height;

    var rShift = TEMP_SHIFT + TINT_SHIFT;
    var gShift = -TINT_SHIFT * 2;
    var bShift = -TEMP_SHIFT + TINT_SHIFT;
    var lutR = buildChannelLUT(rShift);
    var lutG = buildChannelLUT(gShift);
    var lutB = buildChannelLUT(bShift);

    var cx = w / 2, cy = h / 2;
    var maxDist = Math.sqrt(cx * cx + cy * cy);

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;

        var r = lutR[data[i]], g = lutG[data[i + 1]], b = lutB[data[i + 2]];

        var hsl = rgbToHsl(r, g, b);
        var hh = hsl[0], ss = hsl[1], ll = hsl[2];

        if (hh >= 170 && hh < 250) {          // blue/cyan — sky, water
          ss *= 0.85;
          hh += (190 - hh) * 0.25;
        } else if (hh >= 70 && hh < 170) {    // green — foliage
          ll *= 0.90;
          ss *= 0.85;
          hh += (65 - hh) * 0.25;
        } else if (hh >= 20 && hh < 70) {     // orange/yellow — wood, skin, warm light
          ss *= 1.08;
        }

        ss = clamp01(ss + 4 * VIBRANCE * ss * (1 - ss)); // vibrance: tapers to 0 at both s=0 (true neutrals stay neutral) and s=1, peaks at mid saturation
        ss = clamp01(ss * (1 + SAT_GLOBAL));    // global saturation

        var rgb = hslToRgb(hh, ss, ll);
        r = rgb[0]; g = rgb[1]; b = rgb[2];

        // Split toning: cool shadows, warm highlights, weighted by luminance
        var shadowW = clamp01(1 - ll / 0.5);
        var highW = clamp01((ll - 0.5) / 0.5);
        r += -SPLIT_TONE_STRENGTH * shadowW * 0.5 + SPLIT_TONE_STRENGTH * highW * 1.0;
        g += SPLIT_TONE_STRENGTH * shadowW * 0.45 + SPLIT_TONE_STRENGTH * highW * 0.6;
        b += SPLIT_TONE_STRENGTH * shadowW * 1.0 - SPLIT_TONE_STRENGTH * highW * 0.55;

        // Vignette
        var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxDist;
        var v = 1 - smoothstep(0.55, 1.0, dist) * VIGNETTE_AMOUNT;
        r *= v; g *= v; b *= v;

        data[i] = clamp255(r);
        data[i + 1] = clamp255(g);
        data[i + 2] = clamp255(b);
      }
    }

    applyClarity(data, w, h);
    return imageData;
  }

  /* ---- Clarity: luminance-only local-contrast boost via a separable
     box blur used as a cheap Gaussian approximation (3 passes), so
     texture (stone/wood/fabric) gains presence without color fringing
     and without a second, separate "sharpness" pass. ---- */
  function boxBlurH(src, dst, w, h, r) {
    var norm = 1 / (r + r + 1);
    for (var y = 0; y < h; y++) {
      var row = y * w, sum = 0, i;
      for (i = -r; i <= r; i++) sum += src[row + Math.min(w - 1, Math.max(0, i))];
      for (var x = 0; x < w; x++) {
        dst[row + x] = sum * norm;
        sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
  }
  function boxBlurV(src, dst, w, h, r) {
    var norm = 1 / (r + r + 1);
    for (var x = 0; x < w; x++) {
      var sum = 0, i;
      for (i = -r; i <= r; i++) sum += src[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (var y = 0; y < h; y++) {
        dst[y * w + x] = sum * norm;
        sum += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
      }
    }
  }

  function applyClarity(data, w, h) {
    var n = w * h;
    var lum = new Float32Array(n);
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    var radius = Math.max(3, Math.min(16, Math.round(Math.min(w, h) / 80)));
    var tmp = new Float32Array(n), blur = new Float32Array(n);
    var src = lum;
    for (var pass = 0; pass < 3; pass++) {
      boxBlurH(src, tmp, w, h, radius);
      boxBlurV(tmp, blur, w, h, radius);
      src = blur;
    }

    for (p = 0, i = 0; p < n; p++, i += 4) {
      var l = lum[p];
      var newLum = l + (l - blur[p]) * CLARITY_AMOUNT;
      var factor = l > 2 ? newLum / l : 1;
      if (factor < 0.6) factor = 0.6;
      if (factor > 1.6) factor = 1.6;
      data[i] = clamp255(data[i] * factor);
      data[i + 1] = clamp255(data[i + 1] * factor);
      data[i + 2] = clamp255(data[i + 2] * factor);
    }
  }

  function gradeCanvas(canvas) {
    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    gradeImageData(imageData);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  return { gradeCanvas: gradeCanvas, gradeImageData: gradeImageData };
})();
