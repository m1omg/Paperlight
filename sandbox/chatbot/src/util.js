/* Pip: shared helpers. Every file adds itself to the global Pip namespace (browser or Node). */
(function (P) {
  "use strict";

  // Small seeded PRNG (mulberry32) so tests can be reproducible; seeded from time by default.
  let seed = (Date.now() ^ 0x5eed) >>> 0;
  function rand() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function setSeed(s) { seed = s >>> 0; }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function chance(p) { return rand() < p; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Optimal-string-alignment distance (edits + adjacent swaps). Returns 99 once it exceeds max.
  function levenshtein(a, b, max) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (max === undefined) max = 99;
    if (Math.abs(la - lb) > max) return 99;
    let pp = null, prev = new Array(lb + 1), cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i;
      let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return 99;
      pp = prev; prev = cur; cur = new Array(lb + 1);
    }
    return prev[lb] > max ? 99 : prev[lb];
  }

  function capitalizeFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function titleCase(s) { return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()); }

  // Fill {placeholders} from an object; unknown ones become empty.
  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""));
  }

  // "a, b and c"
  function listJoin(items, word) {
    word = word || "and";
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " " + word + " " + items[items.length - 1];
  }

  // "a ewer", "a unicorn", "a one-off", but "an hour", "an honest", "an MRI"
  function aOrAn(word) { return (/^[aeiou]/i.test(word) && !/^(uni|use|usu|uti|ure|eu|ewe|ewer|one|once|uk\b|us\b)/i.test(word)) || /^(hour|honest|honou?r|heir)/i.test(word) ? "an" : "a"; }

  function plural(n, word, pluralWord) { return n + " " + (n === 1 ? word : pluralWord || word + "s"); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  P.util = { rand, setSeed, pick, chance, shuffle, levenshtein, capitalizeFirst, titleCase, fill, listJoin, aOrAn,
    plural, escapeHtml, clamp };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
