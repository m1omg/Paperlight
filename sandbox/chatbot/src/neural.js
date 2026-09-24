/* Pip: neural networks, running in plain JavaScript (no libraries, no server).
   - a byte-level BPE tokenizer (same algorithm as GPT-2, vocabulary trained on our dialogue corpus)
   - "PipGPT": a small decoder-only transformer trained from scratch to continue conversations
   - a dual encoder (2-layer transformer) that scores how well a reply fits a context; it retrieves
     human-written replies from a bank of ~60k lines and also judges the GPT's own samples.
   Weights are exported by training/export.py into data/*.js as base64 int8 (dequantized at load). */
(function (P) {
  "use strict";
  const U = P.util;

  // ---------- base64 / int8 helpers ----------
  function b64ToBytes(b64) {
    if (typeof Buffer !== "undefined" && typeof window === "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // All weights and scratch buffers live in one arena. With WebAssembly SIMD available the arena is the
  // wasm memory and matrix products run in the compiled kernel (src/wasm.js); otherwise plain JS arrays.
  class Arena {
    constructor(totalFloats) {
      this.wasm = null;
      try {
        if (P.wasmLinear && typeof WebAssembly !== "undefined") {
          const bytes = b64ToBytes(P.wasmLinear);
          if (WebAssembly.validate(bytes)) {
            const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), {});
            inst.exports.memory.grow(Math.ceil((totalFloats * 4 + 1024) / 65536));
            this.wasm = inst.exports; this.mem = inst.exports.memory;
          }
        }
      } catch (e) { this.wasm = null; }
      this.off = 64; // byte 0 is reserved: the kernel treats bias address 0 as "no bias"
    }
    alloc(n) {
      if (!this.wasm) return new Float32Array(n);
      const off = this.off;
      this.off += Math.ceil((n * 4) / 16) * 16;
      if (this.off > this.mem.buffer.byteLength) throw new Error("arena full");
      return new Float32Array(this.mem.buffer, off, n);
    }
    mark() { return this.off; }
    release(m) { this.off = m; }
  }
  let ARENA = null;

  // tensors: {name: [shape, offsetInBlob, kind]} kind "q8" (int8 + per-row float32 scale) or "f32"
  function tensorFloats(model) { let n = 0; for (const [shape] of Object.values(model.tensors)) n += shape.reduce((a, b) => a * b, 1) + 4; return n; }
  function unpack(model) {
    const blob = b64ToBytes(model.blob);
    const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const T = {};
    for (const [name, [shape, off, kind]] of Object.entries(model.tensors)) {
      const n = shape.reduce((a, b) => a * b, 1);
      const out = ARENA ? ARENA.alloc(n) : new Float32Array(n);
      if (kind === "f32") { for (let i = 0; i < n; i++) out[i] = dv.getFloat32(off + 4 * i, true); }
      else {
        const rows = shape[0], cols = n / rows;
        const q = new Int8Array(blob.buffer, blob.byteOffset + off + 4 * rows, n);
        for (let r = 0; r < rows; r++) {
          const s = dv.getFloat32(off + 4 * r, true);
          const base = r * cols;
          for (let c = 0; c < cols; c++) out[base + c] = q[base + c] * s;
        }
      }
      T[name] = out;
    }
    return T;
  }
  // temporary buffers for one forward pass (released afterwards)
  const scratch = (n) => (ARENA ? ARENA.alloc(n) : new Float32Array(n));

  // ---------- math kernels ----------
  // Y[r][o] = X[r] . W[o] + b[o]   (W row-major [out][in], like PyTorch Linear).
  // Rows are processed four at a time so each weight is read once for four rows (about 2x faster).
  function linear1(X, rows, inDim, W, b, outDim, Y, xo, yo) {
    for (let r = 0; r < rows; r++) {
      const x = xo + r * inDim;
      for (let o = 0; o < outDim; o++) {
        const w = o * inDim;
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0, i = 0;
        for (; i + 3 < inDim; i += 4) { s0 += W[w + i] * X[x + i]; s1 += W[w + i + 1] * X[x + i + 1]; s2 += W[w + i + 2] * X[x + i + 2]; s3 += W[w + i + 3] * X[x + i + 3]; }
        for (; i < inDim; i++) s0 += W[w + i] * X[x + i];
        Y[yo + r * outDim + o] = s0 + s1 + s2 + s3 + (b ? b[o] : 0);
      }
    }
  }
  function linear(X, rows, inDim, W, b, outDim, Y) {
    if (ARENA && ARENA.wasm && (inDim & 3) === 0) {
      const buf = ARENA.mem.buffer;
      if (X.buffer === buf && W.buffer === buf && Y.buffer === buf && (!b || b.buffer === buf)) {
        ARENA.wasm.linear(X.byteOffset, rows, inDim, W.byteOffset, b ? b.byteOffset : 0, outDim, Y.byteOffset);
        return;
      }
    }
    let r = 0;
    for (; r + 3 < rows; r += 4) {
      const x0 = r * inDim, x1 = x0 + inDim, x2 = x1 + inDim, x3 = x2 + inDim;
      const y0 = r * outDim, y1 = y0 + outDim, y2 = y1 + outDim, y3 = y2 + outDim;
      for (let o = 0; o < outDim; o++) {
        const w = o * inDim;
        let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
        for (let i = 0; i < inDim; i++) { const wi = W[w + i]; a0 += wi * X[x0 + i]; a1 += wi * X[x1 + i]; a2 += wi * X[x2 + i]; a3 += wi * X[x3 + i]; }
        const bias = b ? b[o] : 0;
        Y[y0 + o] = a0 + bias; Y[y1 + o] = a1 + bias; Y[y2 + o] = a2 + bias; Y[y3 + o] = a3 + bias;
      }
    }
    if (r < rows) linear1(X, rows - r, inDim, W, b, outDim, Y, r * inDim, r * outDim);
  }
  function layerNorm(X, rows, d, g, b, Y) {
    for (let r = 0; r < rows; r++) {
      const o = r * d;
      let mean = 0; for (let i = 0; i < d; i++) mean += X[o + i]; mean /= d;
      let v = 0; for (let i = 0; i < d; i++) { const t = X[o + i] - mean; v += t * t; }
      const inv = 1 / Math.sqrt(v / d + 1e-5);
      for (let i = 0; i < d; i++) Y[o + i] = (X[o + i] - mean) * inv * g[i] + b[i];
    }
  }
  const GC = Math.sqrt(2 / Math.PI);
  function geluTanh(X) { for (let i = 0; i < X.length; i++) { const x = X[i]; X[i] = 0.5 * x * (1 + Math.tanh(GC * (x + 0.044715 * x * x * x))); } }
  function erf(x) { // Abramowitz & Stegun 7.1.26 (max error 1.5e-7)
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function geluErf(X) { for (let i = 0; i < X.length; i++) { const x = X[i]; X[i] = 0.5 * x * (1 + erf(x / Math.SQRT2)); } }

  // ---------- BPE tokenizer (GPT-2 byte level) ----------
  class Tokenizer {
    constructor(spec) {
      this.vocab = spec.vocab;                      // id -> token string (byte-level unicode)
      this.ids = new Map(this.vocab.map((t, i) => [t, i]));
      this.ranks = new Map(spec.merges.map((m, i) => [m, i]));
      this.specials = spec.specials;                // ["<|end|>", ...]
      this.special = Object.fromEntries(this.specials.map((s) => [s, this.ids.get(s)]));
      const bs = [];
      for (let i = 33; i <= 126; i++) bs.push(i);
      for (let i = 161; i <= 172; i++) bs.push(i);
      for (let i = 174; i <= 255; i++) bs.push(i);
      const cs = bs.slice();
      let n = 0;
      for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
      this.byteEnc = new Array(256); this.byteDec = new Map();
      bs.forEach((b, i) => { const ch = String.fromCharCode(cs[i]); this.byteEnc[b] = ch; this.byteDec.set(ch, b); });
      this.pat = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
      this.cache = new Map();
      this.enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
      this.dec = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
    }
    bpe(word) {
      if (this.cache.has(word)) return this.cache.get(word);
      let parts = Array.from(word);
      while (parts.length > 1) {
        let best = -1, bestRank = Infinity;
        for (let i = 0; i < parts.length - 1; i++) {
          const r = this.ranks.get(parts[i] + " " + parts[i + 1]);
          if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
        }
        if (best < 0) break;
        parts = parts.slice(0, best).concat([parts[best] + parts[best + 1]], parts.slice(best + 2));
      }
      const ids = parts.map((p) => this.ids.get(p)).filter((x) => x !== undefined);
      if (this.cache.size > 20000) this.cache.clear();
      this.cache.set(word, ids);
      return ids;
    }
    encode(text) {
      const out = [];
      // split on special tokens first
      const re = new RegExp("(" + this.specials.map((s) => s.replace(/[|]/g, "\\|")).join("|") + ")");
      for (const piece of text.split(re)) {
        if (!piece) continue;
        if (this.special[piece] !== undefined) { out.push(this.special[piece]); continue; }
        for (const m of piece.matchAll(this.pat)) {
          const bytes = this.enc ? this.enc.encode(m[0]) : Buffer.from(m[0], "utf8");
          let s = "";
          for (const b of bytes) s += this.byteEnc[b];
          out.push(...this.bpe(s));
        }
      }
      return out;
    }
    decode(ids) {
      let s = "";
      for (const id of ids) s += this.vocab[id];
      // specials come back as-is, everything else maps unicode->bytes
      const parts = s.split(/(<\|[a-z]+\|>)/);
      let out = "";
      for (const p of parts) {
        if (/^<\|[a-z]+\|>$/.test(p)) { out += p; continue; }
        const bytes = new Uint8Array(Array.from(p).map((ch) => (this.byteDec.has(ch) ? this.byteDec.get(ch) : 32)));
        out += this.dec ? this.dec.decode(bytes) : Buffer.from(bytes).toString("utf8");
      }
      return out;
    }
  }

  // ---------- PipGPT ----------
  class GPT {
    constructor(model) {
      this.cfg = model.config;
      this.w = unpack(model);
      this.params = model.params;
    }
    // run rows of tokens through the network, appending to the per-sequence KV caches.
    // seqs: [{cache: [{k,v}...], len}], toks: token per row, seqOf: row -> seq index. Returns logits for the requested rows.
    forward(tokens, positions, caches, needLogits) {
      const { d, layers, heads } = this.cfg, hd = d / heads, rows = tokens.length, w = this.w;
      const mk = ARENA ? ARENA.mark() : 0;
      try {
      const x = scratch(rows * d), h = scratch(rows * d);
      const qkv = scratch(rows * 3 * d), att = scratch(rows * d), tmp = scratch(rows * d);
      const f = scratch(rows * 4 * d);
      for (let r = 0; r < rows; r++) {
        const te = tokens[r] * d, pe = positions[r] * d;
        for (let i = 0; i < d; i++) x[r * d + i] = w["tok.weight"][te + i] + w["pos.weight"][pe + i];
      }
      const scale = 1 / Math.sqrt(hd);
      for (let l = 0; l < layers; l++) {
        const p = "blocks." + l + ".";
        layerNorm(x, rows, d, w[p + "ln1.weight"], w[p + "ln1.bias"], h);
        linear(h, rows, d, w[p + "qkv.weight"], w[p + "qkv.bias"], 3 * d, qkv);
        // write k, v into caches
        for (let r = 0; r < rows; r++) {
          const c = caches[r][l], pos = positions[r];
          for (let i = 0; i < d; i++) { c.k[pos * d + i] = qkv[r * 3 * d + d + i]; c.v[pos * d + i] = qkv[r * 3 * d + 2 * d + i]; }
        }
        for (let r = 0; r < rows; r++) {
          const c = caches[r][l], T = positions[r] + 1;
          const sc = new Float32Array(T);
          for (let hh = 0; hh < heads; hh++) {
            const qo = r * 3 * d + hh * hd;
            let mx = -Infinity;
            for (let j = 0; j < T; j++) {
              let s = 0; const ko = j * d + hh * hd;
              for (let i = 0; i < hd; i++) s += qkv[qo + i] * c.k[ko + i];
              s *= scale; sc[j] = s; if (s > mx) mx = s;
            }
            let sum = 0;
            for (let j = 0; j < T; j++) { sc[j] = Math.exp(sc[j] - mx); sum += sc[j]; }
            const ao = r * d + hh * hd;
            for (let i = 0; i < hd; i++) att[ao + i] = 0;
            for (let j = 0; j < T; j++) {
              const pj = sc[j] / sum, vo = j * d + hh * hd;
              for (let i = 0; i < hd; i++) att[ao + i] += pj * c.v[vo + i];
            }
          }
        }
        linear(att, rows, d, w[p + "proj.weight"], w[p + "proj.bias"], d, tmp);
        for (let i = 0; i < rows * d; i++) x[i] += tmp[i];
        layerNorm(x, rows, d, w[p + "ln2.weight"], w[p + "ln2.bias"], h);
        linear(h, rows, d, w[p + "fc.weight"], w[p + "fc.bias"], 4 * d, f);
        geluTanh(f);
        linear(f, rows, 4 * d, w[p + "out.weight"], w[p + "out.bias"], d, tmp);
        for (let i = 0; i < rows * d; i++) x[i] += tmp[i];
      }
      if (!needLogits) return null;
      // logits only for rows that need them
      const idx = needLogits === true ? [...Array(rows).keys()] : needLogits;
      const hsel = scratch(idx.length * d);
      const xs = scratch(idx.length * d);
      idx.forEach((r, k) => xs.set(x.subarray(r * d, r * d + d), k * d));
      layerNorm(xs, idx.length, d, w["ln.weight"], w["ln.bias"], hsel);
      const V = this.cfg.vocab;
      const logits = scratch(idx.length * V);
      linear(hsel, idx.length, d, w["tok.weight"], null, V, logits);
      return Float32Array.from(logits);
      } finally { if (ARENA) ARENA.release(mk); }
    }
    newCache() {
      const { d, layers, ctx } = this.cfg;
      return Array.from({ length: layers }, () => ({ k: new Float32Array(ctx * d), v: new Float32Array(ctx * d) }));
    }
    cloneCache(c, len, cap) {
      const d = this.cfg.d, n = (cap || this.cfg.ctx) * d;
      return c.map((l) => { const k = new Float32Array(n), v = new Float32Array(n); k.set(l.k.subarray(0, len * d)); v.set(l.v.subarray(0, len * d)); return { k, v }; });
    }
    // average log-probability of each continuation (token ids) after the prompt, plus the end-of-turn token.
    // All continuations share one prefill of the prompt; rows are batched through the network.
    async scoreContinuations(prompt, conts, endTok, yieldFn) {
      const ctx = this.cfg.ctx, V = this.cfg.vocab;
      const maxL = Math.max(1, ...conts.map((c) => c.length));
      prompt = prompt.slice(-(ctx - maxL - 2));
      const T = prompt.length, base = this.newCache();
      let last = null;
      for (let s0 = 0; s0 < T; s0 += 32) {
        const toks = prompt.slice(s0, s0 + 32);
        last = this.forward(toks, toks.map((_, i) => s0 + i), toks.map(() => base), s0 + 32 >= T ? [toks.length - 1] : null);
      }
      const lsm = (lg, off, id) => { let mx = -Infinity; for (let i = 0; i < V; i++) if (lg[off + i] > mx) mx = lg[off + i]; let z = 0; for (let i = 0; i < V; i++) z += Math.exp(lg[off + i] - mx); return lg[off + id] - mx - Math.log(z); };
      const scores = [];
      let group = [];
      const flush = async () => {
        if (!group.length) return;
        const toks = [], pos = [], caches = [], owners = [];
        for (const g of group) {
          const c = conts[g];
          const cache = this.cloneCache(base, T, T + c.length + 1);
          for (let k = 0; k < c.length; k++) { toks.push(c[k]); pos.push(T + k); caches.push(cache); owners.push([g, k]); }
        }
        const lg = this.forward(toks, pos, caches, true);
        for (const g of group) scores[g] = { sum: lsm(last, 0, conts[g][0] !== undefined ? conts[g][0] : endTok), n: 1 };
        owners.forEach(([g, k], row) => {
          const c = conts[g];
          const next = k + 1 < c.length ? c[k + 1] : endTok;
          scores[g].sum += lsm(lg, row * V, next); scores[g].n++;
        });
        group = [];
        if (yieldFn) await yieldFn();
      };
      let rows = 0;
      for (let g = 0; g < conts.length; g++) {
        if (rows + conts[g].length > 64) { await flush(); rows = 0; }
        group.push(g); rows += conts[g].length;
      }
      await flush();
      return scores.map((x) => x.sum / x.n);
    }
    // sample n continuations of `prompt` (token ids); stop on any stop token
    async sample(prompt, n, opts) {
      const o = Object.assign({ maxNew: 36, temp: 0.8, topK: 40, topP: 0.9, repPenalty: 1.2, stop: [], ban: [] }, opts || {});
      const ctx = this.cfg.ctx;
      prompt = prompt.slice(-(ctx - o.maxNew - 1));
      const base = this.newCache();
      const T = prompt.length;
      // prefill in chunks (rows share the same cache)
      const chunk = 32;
      let lastLogits = null;
      for (let s = 0; s < T; s += chunk) {
        const toks = prompt.slice(s, s + chunk);
        const pos = toks.map((_, i) => s + i);
        const caches = toks.map(() => base);
        const last = s + chunk >= T;
        lastLogits = this.forward(toks, pos, caches, last ? [toks.length - 1] : null);
        if (o.yieldFn) await o.yieldFn();
      }
      const V = this.cfg.vocab;
      const seqs = Array.from({ length: n }, () => ({ cache: this.cloneCache(base, T), out: [], done: false, logp: 0 }));
      let logits = [];
      for (let i = 0; i < n; i++) logits.push(lastLogits.subarray(0, V));
      for (let step = 0; step < o.maxNew; step++) {
        const live = seqs.map((s, i) => i).filter((i) => !seqs[i].done);
        if (!live.length) break;
        const next = [];
        for (const i of live) {
          const s = seqs[i];
          const lg = Float32Array.from(logits[i]);
          for (const t of o.ban) lg[t] = -1e9;
          if (step < 2) for (const t of o.stop) lg[t] = -1e9;   // at least a couple of tokens
          for (const t of new Set(s.out)) lg[t] = lg[t] > 0 ? lg[t] / o.repPenalty : lg[t] * o.repPenalty;
          const tok = sampleLogits(lg, o.temp, o.topK, o.topP);
          s.logp += tok.logp;
          if (o.stop.includes(tok.id) || T + s.out.length + 1 >= ctx) { s.done = true; s.stopped = o.stop.includes(tok.id); continue; }
          s.out.push(tok.id);
          next.push(i);
        }
        if (!next.length) break;
        const toks = next.map((i) => seqs[i].out[seqs[i].out.length - 1]);
        const pos = next.map((i) => T + seqs[i].out.length - 1);
        const caches = next.map((i) => seqs[i].cache);
        const lg = this.forward(toks, pos, caches, true);
        next.forEach((i, k) => { logits[i] = lg.subarray(k * V, (k + 1) * V); });
        if (o.yieldFn && step % 4 === 3) await o.yieldFn();
      }
      return seqs.map((s) => ({ ids: s.out, logp: s.logp / Math.max(1, s.out.length), finished: !!s.stopped }));
    }
  }
  function sampleLogits(lg, temp, topK, topP) {
    // keep the topK largest logits (small sorted list; no full sort of the vocabulary)
    const V = lg.length, k = Math.min(topK, V);
    const top = [], vals = [];
    for (let i = 0; i < V; i++) {
      const v = lg[i];
      if (top.length === k && v <= vals[k - 1]) continue;
      let j = top.length === k ? k - 1 : top.length;
      while (j > 0 && vals[j - 1] < v) { if (j < k) { vals[j] = vals[j - 1]; top[j] = top[j - 1]; } j--; }
      vals[j] = v; top[j] = i;
      if (top.length > k) { top.length = k; vals.length = k; }
    }
    const mx = vals[0];
    let probs = vals.map((v) => Math.exp((v - mx) / temp));
    const sum = probs.reduce((a, b) => a + b, 0);
    probs = probs.map((p) => p / sum);
    let cum = 0, cut = probs.length;
    for (let i = 0; i < probs.length; i++) { cum += probs[i]; if (cum >= topP) { cut = i + 1; break; } }
    const ps = probs.slice(0, cut), ids = top.slice(0, cut);
    const s2 = ps.reduce((a, b) => a + b, 0);
    let r = U.rand() * s2;
    for (let i = 0; i < ps.length; i++) { r -= ps[i]; if (r <= 0) return { id: ids[i], logp: Math.log(ps[i] / s2) }; }
    return { id: ids[ids.length - 1], logp: Math.log(ps[ps.length - 1] / s2) };
  }

  // ---------- dual encoder ----------
  class Encoder {
    constructor(model) { this.cfg = model.config; this.w = unpack(model); }
    pooled(ids) {
      const { d, layers, heads, maxlen } = this.cfg, hd = d / heads, w = this.w;
      ids = ids.slice(0, maxlen);
      const T = Math.max(1, ids.length);
      const mk = ARENA ? ARENA.mark() : 0;
      try {
      const x = scratch(T * d), h = scratch(T * d), qkv = scratch(T * 3 * d);
      const att = scratch(T * d), tmp = scratch(T * d), f = scratch(T * 4 * d);
      for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) x[t * d + i] = w["tok.weight"][(ids[t] || 0) * d + i] + w["pos.weight"][t * d + i];
      const scale = 1 / Math.sqrt(hd), sc = new Float32Array(T);
      for (let l = 0; l < layers; l++) {
        const p = "layers." + l + ".";
        layerNorm(x, T, d, w[p + "norm1.weight"], w[p + "norm1.bias"], h);
        linear(h, T, d, w[p + "self_attn.in_proj_weight"], w[p + "self_attn.in_proj_bias"], 3 * d, qkv);
        att.fill(0);
        for (let hh = 0; hh < heads; hh++) {
          for (let t = 0; t < T; t++) {
            const qo = t * 3 * d + hh * hd;
            let mx = -Infinity;
            for (let j = 0; j < T; j++) {
              let s = 0; const ko = j * 3 * d + d + hh * hd;
              for (let i = 0; i < hd; i++) s += qkv[qo + i] * qkv[ko + i];
              s *= scale; sc[j] = s; if (s > mx) mx = s;
            }
            let sum = 0;
            for (let j = 0; j < T; j++) { sc[j] = Math.exp(sc[j] - mx); sum += sc[j]; }
            const ao = t * d + hh * hd;
            for (let j = 0; j < T; j++) { const pj = sc[j] / sum, vo = j * 3 * d + 2 * d + hh * hd; for (let i = 0; i < hd; i++) att[ao + i] += pj * qkv[vo + i]; }
          }
        }
        linear(att, T, d, w[p + "self_attn.out_proj.weight"], w[p + "self_attn.out_proj.bias"], d, tmp);
        for (let i = 0; i < T * d; i++) x[i] += tmp[i];
        layerNorm(x, T, d, w[p + "norm2.weight"], w[p + "norm2.bias"], h);
        linear(h, T, d, w[p + "linear1.weight"], w[p + "linear1.bias"], 4 * d, f);
        geluErf(f);
        linear(f, T, 4 * d, w[p + "linear2.weight"], w[p + "linear2.bias"], d, tmp);
        for (let i = 0; i < T * d; i++) x[i] += tmp[i];
      }
      layerNorm(x, T, d, w["ln.weight"], w["ln.bias"], h);
      const pool = new Float32Array(d);
      for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) pool[i] += h[t * d + i] / T;
      return pool;
      } finally { if (ARENA) ARENA.release(mk); }
    }
    head(pool, which) {
      const { d, out } = this.cfg, w = this.w;
      const mk = ARENA ? ARENA.mark() : 0;
      const p = scratch(d), a = scratch(d), bb = scratch(out);
      p.set(pool);
      linear(p, 1, d, w[which + "_head.0.weight"], w[which + "_head.0.bias"], d, a);
      geluErf(a);
      linear(a, 1, d, w[which + "_head.2.weight"], w[which + "_head.2.bias"], out, bb);
      const b = Float32Array.from(bb);
      if (ARENA) ARENA.release(mk);
      let n = 0; for (let i = 0; i < out; i++) n += b[i] * b[i];
      n = Math.sqrt(n) || 1;
      for (let i = 0; i < out; i++) b[i] /= n;
      return b;
    }
    ctx(ids) { return this.head(this.pooled(ids), "ctx"); }
    resp(ids) { return this.head(this.pooled(ids), "resp"); }
  }

  // things a from-scratch AI friend must not claim (port of the filter used to build the reply bank)
  const PERSONA = /\b(my (wife|husband|girlfriend|boyfriend|son|daughter|kids?|children|mom|mum|mother|dad|father|parents|brothers?|sisters?|job|boss|co-?workers?|grand\w+|aunt|uncle|cousins?|baby|car|truck|house|apartment|dog|dogs|cat|cats|pets?|puppy|teacher|class|school|college|university|degree|fianc\w*|church|roommate|body|legs?|arms?|stomach|doctor|office|room|bed|phone|hometown|town|city|country|favorite \w+ (is|are))|i('m| am) (a |an )?(\d+|teacher|nurse|doctor|student|mom|dad|mother|father|lawyer|chef|waitress|waiter|cashier|farmer|vegan|vegetarian|married|single|divorced|pregnant|retired|christian|muslim|jewish|atheist|engaged|parent|writer|artist|musician|singer|engineer|programmer|in (school|college|high school|the army)|from|at work|home|on my way|driving|allergic|human|a (boy|girl|man|woman|guy|lady))|i (work|worked|live|lived|study|studied|teach|taught|drive|drove|grew up|was born|go to (school|college|church|work)|moved|graduated|retired|married|divorced|broke up|just got back|went to|visited|bought|ate|cooked|slept|woke up)\b|i('ve| have|ve| had| got) (a |an |two |three |four |\d+ )?(kids?|children|sons?|daughters?|dogs?|cats?|brothers?|sisters?|husband|wife|boyfriend|girlfriend|job|car|house|pets?|horses?|siblings?|baby)|i('ve| have) been (working|living|married|studying|going)|years? old|my name|call me|when i was (a kid|a child|young|little|younger|in|\d+)|(last|this) (week|night|year|month|weekend|morning)|yesterday|<\|me\|>)/i;
  const BAD = /\b(fuck\w*|shit\w*|bitch\w*|cunt|nigg\w*|fag\w*|retard\w*|slut\w*|whore\w*|dick\w*|cock\w*|pussy|porn\w*|rape\w*|sex\w*|nazi\w*|kill (yourself|you)|kys|die)\b/i;

  // ---------- the neural chat engine ----------
  class Neural {
    constructor(data) {
      this.data = data;
      this.ready = false;
      // how candidate replies are scored (see respond); tuned on test/sample_chat.txt
      // pmi = log P(reply | conversation) - lambda * log P(reply | "ok"): rewards replies that fit THIS conversation
      this.weights = { base: 0.36, sim: 0.45, simRef: 0.55, kw: 0.40, ll: 0, llRef: -3.2, pmi: 0.05, lambda: 0.6, pmiRef: -1.0, gpt: -0.01 };
    }
    async init() {
      const d = this.data;
      this.tok = new Tokenizer(d.tokenizer);
      if (!ARENA) {
        const total = (d.encoder ? tensorFloats(d.encoder) : 0) + (d.gpt ? tensorFloats(d.gpt) : 0) + 1200000;
        ARENA = new Arena(total);
      }
      this.simd = !!ARENA.wasm;
      if (d.encoder) this.enc = new Encoder(d.encoder);
      if (d.bank && this.enc) {
        this.bankText = d.bank.texts;
        const bytes = b64ToBytes(d.bank.emb);
        this.bankDim = d.bank.dim;
        this.bankEmb = new Int8Array(bytes.buffer, bytes.byteOffset + 4 * this.bankText.length, this.bankText.length * this.bankDim);
        this.bankScale = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + 4 * this.bankText.length));
        this.bankSrc = d.bank.src || null;
      }
      if (d.gpt) { this.gpt = new GPT(d.gpt); this.gptParams = d.gpt.params; }
      this.ready = !!(this.enc || this.gpt);
      return this;
    }
    // turn chat history into the training format (lowercase, names -> placeholders)
    _fmt(text, role, names) {
      let s = " " + text.toLowerCase().replace(/\s+/g, " ").trim();
      const me = role === "bot" ? names.bot : names.user, you = role === "bot" ? names.user : names.bot;
      const esc = (x) => x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (me) s = s.replace(new RegExp("\\b" + esc(me) + "\\b", "g"), "<|me|>");
      if (you) s = s.replace(new RegExp("\\b" + esc(you) + "\\b", "g"), "<|you|>");
      return s;
    }
    contextEmbedding(history, userText, names, withBot) {
      // by default only the user's message: feeding Pip's own previous line back in can make retrieval echo itself
      const lastBot = withBot ? [...history].reverse().find((h) => h.role === "bot") : null;
      const ctx = (lastBot ? "<|b|>" + this._fmt(lastBot.text, "bot", names) + " " : "") + "<|a|>" + this._fmt(userText, "user", names);
      return this.enc.ctx(this.tok.encode(ctx).slice(-this.enc.cfg.maxlen));
    }
    retrieve(q, k) {
      const n = this.bankText.length, dim = this.bankDim, E = this.bankEmb, S = this.bankScale;
      const best = [];
      let minBest = -Infinity;
      for (let r = 0; r < n; r++) {
        let s = 0; const o = r * dim;
        for (let i = 0; i < dim; i++) s += q[i] * E[o + i];
        s *= S[r];
        if (best.length < k) { best.push([s, r]); if (best.length === k) { best.sort((a, b) => b[0] - a[0]); minBest = best[k - 1][0]; } }
        else if (s > minBest) { best[k - 1] = [s, r]; best.sort((a, b) => b[0] - a[0]); minBest = best[k - 1][0]; }
      }
      best.sort((a, b) => b[0] - a[0]);
      return best.map(([s, r]) => ({ text: this.bankText[r], sim: s, src: this.bankSrc ? this.bankSrc[r] : null }));
    }
    // keyword search over the messages the bank replies originally answered (BM25)
    _buildBM25() {
      const ctx = this.data.bankctx;
      if (!ctx || this._bm) return;
      const post = new Map(), len = new Float32Array(ctx.length);
      let total = 0;
      for (let i = 0; i < ctx.length; i++) {
        const terms = this._terms(ctx[i]);
        len[i] = terms.length; total += terms.length;
        const tf = new Map();
        for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
        for (const [t, c] of tf) { let a = post.get(t); if (!a) post.set(t, (a = [])); a.push(i, c); }
      }
      this._bm = { post, len, avg: total / Math.max(1, ctx.length), N: ctx.length, acc: new Float32Array(ctx.length) };
    }
    _terms(text) {
      return (text.toLowerCase().match(/[a-z']+/g) || []).map((w) => P.nlp.stem(w.replace(/'s$/, ""))).filter((w) => w.length > 1 && !P.nlp.STOP.has(w));
    }
    keywordSearch(text, k) {
      this._buildBM25();
      const bm = this._bm;
      if (!bm) return [];
      const q = [...new Set(this._terms(text))];
      if (!q.length) return [];
      const acc = bm.acc; acc.fill(0);
      const touched = [];
      let maxPossible = 0;
      for (const t of q) {
        const p = bm.post.get(t);
        if (!p) continue;
        const df = p.length / 2, idf = Math.log(1 + (bm.N - df + 0.5) / (df + 0.5));
        maxPossible += idf * 2.2;
        for (let j = 0; j < p.length; j += 2) {
          const i = p[j], tf = p[j + 1];
          if (acc[i] === 0) touched.push(i);
          acc[i] += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * bm.len[i] / bm.avg));
        }
      }
      touched.sort((a, b) => acc[b] - acc[a]);
      return touched.slice(0, k).map((i) => ({ i, text: this.bankText[i], src: this.bankSrc ? this.bankSrc[i] : null, kw: Math.min(1, acc[i] / Math.max(1e-6, maxPossible)) }));
    }
    respSim(q, text) {
      const e = this.enc.resp(this.tok.encode(" " + text.toLowerCase()).slice(0, this.enc.cfg.maxlen));
      let s = 0; for (let i = 0; i < e.length; i++) s += e[i] * q[i];
      return s;
    }
    _contentWords(text) {
      const set = new Set();
      for (const w of (text.toLowerCase().match(/[a-z']+/g) || [])) {
        const st = P.nlp.stem(w.replace(/'s$/, ""));
        if (st.length > 2 && !P.nlp.STOP.has(st) && !P.nlp.STOP.has(w)) set.add(st);
      }
      return set;
    }
    // a word is "specific" unless it's generic chat vocabulary: a reply about a "menu" or a "dog" when
    // nobody mentioned them is probably off-topic, while "awesome", "happened" or "fun" fit anywhere
    _specific(w) {
      if (!this._generic) {
        this._generic = new Set(("wow awesom cool nice great good bad sad sorry hear happen happened sound fun really yeah yes okay ok sure maybe " +
          "probabl definit true right mean interest interesting amaz happy wonderful fantastic terribl awful horribl glad excit nervous worri " +
          "hard tough easy new old first last next long still ever never always sometim often usual too also just only even again back " +
          "thing someth anyth everyth noth lot much many time day today tonight tomorrow week kind sort way favorit enjoy love like hate " +
          "think know feel go went gone get got do did done make made want need try tell say said see look come came take give put keep " +
          "let help hope wish guess believe understand remember forget care matter plan plans work play talk chat friend people person " +
          "everyone someone anyone nobody everybody somebody thank thanks welcom congrat congratulation luck lucky hug hope proud " +
          "better worse best worst big little bit alot fine well alright pretty quite total absolut honest seriou crazi weird strange " +
          "funny hilari cute sweet kind nice lovely perfect exactly agre point idea question answer reason sens feel feeling mood life " +
          "world year month moment minut hour morn night even afternoon weekend happen stuff yeah haha lol omg god gosh ugh aww hmm " +
          "oh ah hey hi hello bye good-bye poor dear awe awesome amazing exciting terrible worry doing going feeling getting having being " +
          "thinking trying talking playing working looking coming making saying seeing hoping happening comfort support listen listening " +
          "deserve advice share sharing telling asking wondering lately recently anyway anymore though might may would could should " +
          "maybe much many always never really lot").split(" "));
      }
      return !this._generic.has(w) && !this._generic.has(w.replace(/e$/, ""));
    }
    ok(text, userText, recent) {
      const t = text.trim();
      if (t.length < 2 || t.split(/\s+/).length > 40) return false;
      if (PERSONA.test(t) || BAD.test(t)) return false;
      if (/<\|(a|b|end)\|>/.test(t) || /[\/\\|_~^*#{}\[\]]/.test(t.replace(/<\|you\|>/g, ""))) return false;
      const low = t.toLowerCase().replace(/[^a-z ]/g, "");
      if (low === userText.toLowerCase().replace(/[^a-z ]/g, "")) return false;          // parroting
      if (recent && recent.some((r) => r.toLowerCase().replace(/[^a-z ]/g, "") === low)) return false;
      return true;
    }
    // Returns candidate replies [{text, score, source}] for the brain to choose from.
    async respond(history, userText, opts) {
      opts = opts || {};
      const names = { user: opts.name || "", bot: opts.bot || "Pip" };
      const out = [];
      if (!this.enc) return out;
      const lastBotText = ([...history].reverse().find((h) => h.role === "bot") || {}).text || "";
      // include Pip's previous line only when it asked something (then the user's message is an answer)
      const q = this.contextEmbedding(history, userText, names, /\?\s*\S*$/.test(lastBotText) && userText.split(/\s+/).length <= 6);
      const yieldFn = opts.yieldFn || (() => new Promise((r) => setTimeout(r, 0)));
      const ctxAll = history.slice(-2).map((h) => h.text).join(" ") + " " + userText;
      const ctxWords = this._contentWords(ctxAll);
      // keyword matches from messages with few specific words ("that might help") are weak evidence
      const qSpecific = this._terms(userText).filter((w) => this._specific(w)).length;
      const kwScale = Math.min(1, (qSpecific + 0.5) / 2);
      const userSide = history.filter((h) => h.role === "user").slice(-1).map((h) => h.text).join(" ") + " " + userText;
      const ctx3rd = /\b(he|she|him|her|his|hers|mom|mum|dad|mother|father|brother|sister|friend|teacher|boss|girlfriend|boyfriend|wife|husband|cat|dog|coach|grandma|grandpa|son|daughter|baby|uncle|aunt|cousin|neighbou?r)\b/i.test(userSide);
      const ctxFem = /\b(she|her|hers|sister|mom|mum|mother|grandma|grandmother|aunt|girlfriend|wife|daughter|girl|niece|lady|woman)\b/i.test(userSide);
      const ctxMasc = /\b(he|him|his|brother|dad|father|grandpa|grandfather|uncle|boyfriend|husband|son|boy|nephew|guy|man)\b/i.test(userSide);
      const userVal = P.nlp.emotion(P.nlp.words(P.nlp.normalize(userText, { spell: false }))).valence;
      const userAsked = /\?\s*$/.test(userText) || /^(do|does|did|are|is|was|were|can|could|will|would|should|have|has)\b/i.test(userText.trim());
      const cands = [];
      // 1) retrieval from the bank of human-written replies
      if (this.bankText) {
        // someone is opening up about something hard: only lines from the empathetic-listener dataset
        const srcOk = (h) => !opts.deepVent || h.src === "empathetic";
        const hits = this.retrieve(q, opts.deepVent ? 120 : 40).filter((h) => srcOk(h) && this.ok(h.text, userText, opts.recent)).slice(0, 12);
        for (const h of hits) cands.push({ text: h.text, sim: h.sim, src: h.src, source: "neural:retrieval", kw: 0 });
        // replies to past messages that share keywords with this one
        const seenText = new Set(hits.map((h) => h.text));
        for (const h of this.keywordSearch(userText, 30)) {
          if (seenText.has(h.text) || !srcOk(h) || !this.ok(h.text, userText, opts.recent)) continue;
          seenText.add(h.text);
          cands.push({ text: h.text, sim: this.respSim(q, h.text), src: h.src, source: "neural:keyword", kw: h.kw });
          if (cands.length >= 22) break;
        }
      }
      // 2) generation with PipGPT
      const ctxText = history.slice(-6).map((h) => (h.role === "user" ? "<|a|>" : "<|b|>") + this._fmt(h.text, h.role, names)).join("") + "<|a|>" + this._fmt(userText, "user", names) + "<|b|>";
      const prompt = this.gpt ? this.tok.encode(ctxText) : null;
      const sp = this.tok.special;
      if (this.gpt && opts.generate !== false) {
        const samples = await this.gpt.sample(prompt, opts.samples || 4, { stop: [sp["<|a|>"], sp["<|b|>"], sp["<|end|>"]], ban: [], yieldFn, temp: 0.75, maxNew: 32 });
        const seen = new Set();
        for (const smp of samples) {
          if (!smp.finished) continue; // cut off mid-sentence
          const text = this.tok.decode(smp.ids).replace(/<\|me\|>/g, names.bot).trim();
          if (seen.has(text) || !this.ok(text, userText, opts.recent)) continue;
          seen.add(text);
          cands.push({ text, sim: this.respSim(q, text), source: "neural:gpt" });
        }
      }
      if (!cands.length) return out;
      // 3) PipGPT judges every candidate: how likely is it as the next line of this conversation?
      //    Optionally minus how likely it is after a bland context, which penalizes replies that fit anything.
      const W = this.weights;
      if (this.gpt) {
        const conts = cands.map((c) => this.tok.encode(" " + this._fmt(c.text, "bot", names).trim()).slice(0, 40));
        const ll = await this.gpt.scoreContinuations(prompt, conts, sp["<|a|>"], yieldFn);
        const llg = W.pmi ? await this.gpt.scoreContinuations(this.tok.encode("<|a|> ok<|b|>"), conts, sp["<|a|>"], yieldFn) : null;
        cands.forEach((c, i) => { c.ll = ll[i]; if (llg) c.pmi = ll[i] - W.lambda * llg[i]; });
      }
      for (const c of cands) {
        const words = this._contentWords(c.text);
        let novel = 0, shared = 0;
        for (const w of words) { if (ctxWords.has(w)) shared++; else if (this._specific(w)) novel++; }
        const n = c.text.split(/\s+/).length;
        c.lex = 0.025 * Math.min(shared, 2) - 0.06 * Math.min(novel, 3) + (n < 3 ? -0.03 : n > 24 ? -0.03 : 0);
        // "I hope he does!" when nobody mentioned a "he" (or when they talked about their sister)
        if (!ctx3rd && /\b(he|she|him|her|his|hers)\b/i.test(c.text)) c.lex -= 0.08;
        else if (ctxFem && !ctxMasc && /\b(he|him|his)\b/i.test(c.text)) c.lex -= 0.1;
        else if (ctxMasc && !ctxFem && /\b(she|her|hers)\b/i.test(c.text)) c.lex -= 0.1;
        // very short messages with almost no content ("what about in km") give retrieval little to go on
        if (ctxWords.size <= 1 && shared === 0 && userText.split(/\s+/).length <= 5) c.lex -= 0.05;
        // mood must match: no "that's great!" to a bad day, no "that's so sad" to pancakes
        const cv = P.nlp.emotion(P.nlp.words(P.nlp.normalize(c.text, { spell: false }))).valence;
        if (userVal <= -0.5 && cv >= 0.5) c.lex -= 0.14;
        else if (userVal >= 0.3 && cv <= -0.5) c.lex -= 0.14;
        else if (userVal > -0.3 && cv <= -0.8 && !opts.venting) c.lex -= 0.06;
        if (userVal >= 0.3 && /^(oh no|sorry|i'?m sorry|that'?s (terrible|awful|horrible|sad)|what happened)/i.test(c.text)) c.lex -= 0.12;
        if (opts.venting && /\b(go for it|you should|why (don'?t|haven'?t) you|congrat\w*|awesome|lucky|have fun|lol|haha)\b/i.test(c.text)) c.lex -= 0.1;
        if (opts.venting && cv >= 0.5) c.lex -= 0.1;   // no "so proud of him!" right after a complaint
        // while someone is opening up, only the empathetic listener lines get the benefit of the doubt
        if (opts.venting && c.src !== "empathetic") c.lex -= 0.06;
        // and in a serious conversation a reply has to sound like listening
        if (opts.deepVent && !/\b(sorry|hear|sounds?|must (be|have)|understand|hard|tough|awful|terrible|horrible|sad|scary|scared|upset|feel|feeling|hope|here for you|with you|alone|hug|poor|that's rough|i bet|can imagine|makes sense)\b/i.test(c.text)) c.lex -= 0.12;
        // "Yes, I love it." as a reply to something that wasn't a question
        if (!userAsked && /^(yes|yeah|yep|no|nope|nah|sure|of course)\b/i.test(c.text)) c.lex -= 0.05;
        // keyword matches only count fully when they cover most of what the user said
        const kwEff = ((c.kw || 0) >= 0.45 ? c.kw : (c.kw || 0) * 0.4) * kwScale;
        c.score = W.base + W.sim * (c.sim - W.simRef) + W.kw * kwEff + c.lex +
          (c.ll !== undefined ? W.ll * U.clamp(c.ll - W.llRef, -2.5, 2) : 0) + (c.pmi !== undefined ? W.pmi * U.clamp(c.pmi - W.pmiRef, -2.5, 2.5) : 0) +
          (opts.venting && c.src === "empathetic" ? 0.03 : 0) + (c.source === "neural:gpt" ? W.gpt : 0);
        out.push({ text: c.text, score: Math.min(c.score, 0.84), source: c.source === "neural:keyword" ? "neural:retrieval" : c.source, sim: c.sim, ll: c.ll, lex: c.lex, kw: c.kw, pmi: c.pmi });
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, 8);      return out;
    }
  }
  // map encoder cosine similarity onto the brain's 0..1 confidence scale
  function calib(sim) { return U.clamp(0.28 + (sim - 0.2) * 0.9, 0.2, 0.78); }

  P.Neural = Neural;
  P.neuralParts = { Tokenizer, GPT, Encoder, unpack, b64ToBytes, Arena, setArena: (a) => { ARENA = a; }, tensorFloats };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
