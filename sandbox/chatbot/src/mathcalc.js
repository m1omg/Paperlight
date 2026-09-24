/* Pip: calculator and unit converter.
   Arithmetic is done with exact fractions (BigInt numerator/denominator), so decimals and negative numbers
   follow the normal rules of decimal arithmetic: 0.1 + 0.2 = 0.3 exactly, -3 - -7 = 4, 1/8 = 0.125.
   Only things that can't be exact (square roots of non-squares, trig, logs) fall back to floating point,
   and those results are rounded to 12 significant digits and marked with "≈". */
(function (P) {
  "use strict";

  // ---------- exact rationals ----------
  const B = (x) => BigInt(x);
  const ZERO = B(0), ONE = B(1), TEN = B(10);
  function gcd(a, b) { a = a < 0 ? -a : a; b = b < 0 ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
  class Q {
    constructor(n, d) {
      if (d === undefined) d = ONE;
      if (d === ZERO) throw new CalcError("divide by zero");
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d) || ONE;
      this.n = n / g; this.d = d / g;
    }
    static of(x) { return x instanceof Q ? x : Q.parse(String(x)); }
    static parse(s) {
      const m = /^(-)?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s.trim());
      if (!m || (!m[2] && !m[3])) throw new CalcError("bad number " + s);
      const frac = m[3] || "";
      let n = B((m[2] || "0") + frac), d = TEN ** B(frac.length);
      if (m[4]) { const e = parseInt(m[4], 10); if (Math.abs(e) > 400) throw new CalcError("too big"); if (e >= 0) n *= TEN ** B(e); else d *= TEN ** B(-e); }
      return new Q(m[1] ? -n : n, d);
    }
    add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { return new Q(this.n * o.n, this.d * o.d); }
    div(o) { if (o.n === ZERO) throw new CalcError("divide by zero"); return new Q(this.n * o.d, this.d * o.n); }
    neg() { return new Q(-this.n, this.d); }
    isInt() { return this.d === ONE; }
    sign() { return this.n > 0 ? 1 : this.n < 0 ? -1 : 0; }
    toNumber() { return Number(this.n) / Number(this.d); }
    finiteDecimal() { let d = this.d; while (d % B(2) === ZERO) d /= B(2); while (d % B(5) === ZERO) d /= B(5); return d === ONE; }
    // decimal string, exact when finite, otherwise rounded (half away from zero) to `places`
    toDecimal(places) {
      const neg = this.n < 0, n = neg ? -this.n : this.n;
      let intPart = n / this.d, rem = n % this.d;
      if (rem === ZERO) return (neg && intPart !== ZERO ? "-" : "") + intPart.toString();
      let digits = "";
      const exact = this.finiteDecimal();
      const max = exact ? 1000 : places;
      while (rem !== ZERO && digits.length < max) { rem *= TEN; digits += (rem / this.d).toString(); rem %= this.d; }
      if (rem !== ZERO) {  // round the last kept digit
        const next = (rem * TEN) / this.d;
        if (next >= B(5)) {
          let arr = (intPart.toString() + digits).split("").map(Number), i = arr.length - 1;
          while (i >= 0) { if (arr[i] === 9) { arr[i] = 0; i--; } else { arr[i]++; break; } }
          if (i < 0) arr.unshift(1);
          const s = arr.join("");
          intPart = B(s.slice(0, s.length - digits.length)); digits = s.slice(s.length - digits.length);
        }
        digits = digits.replace(/0+$/, "");
      }
      const body = intPart.toString() + (digits ? "." + digits : "");
      return (neg && /[1-9]/.test(body) ? "-" : "") + body;
    }
    toString() { return this.d === ONE ? this.n.toString() : this.n + "/" + this.d; }
  }
  class CalcError extends Error {}

  // A value is exact (Q) or approximate (JS number).
  const isQ = (v) => v instanceof Q;
  const num = (v) => (isQ(v) ? v.toNumber() : v);
  function approx(x) {
    if (!isFinite(x)) throw new CalcError(isNaN(x) ? "undefined" : "too big");
    // snap float noise to exact when it is extremely close to a short decimal
    const r = Math.round(x * 1e9) / 1e9;
    if (Math.abs(r - x) < 1e-12 * Math.max(1, Math.abs(x))) { try { return Q.parse(r.toFixed(9).replace(/\.?0+$/, "")); } catch (e) { /* fall through */ } }
    return x;
  }
  function op(a, b, name) {
    if (isQ(a) && isQ(b)) return a[name](b);
    const x = num(a), y = num(b);
    if (name === "div" && y === 0) throw new CalcError("divide by zero");
    return approx({ add: x + y, sub: x - y, mul: x * y, div: x / y }[name]);
  }
  function power(a, b) {
    if (isQ(b) && b.isInt() && isQ(a)) {
      let e = b.n; if (e > B(2000) || e < B(-2000)) throw new CalcError("too big");
      const an = a.n < 0 ? -a.n : a.n, digits = (an > a.d ? an : a.d).toString().length;
      if (digits * Number(e < 0 ? -e : e) > 2000) throw new CalcError("too big");
      const neg = e < 0; if (neg) e = -e;
      if (a.n === ZERO && neg) throw new CalcError("divide by zero");
      const r = new Q(a.n ** e, a.d ** e);
      return neg ? new Q(ONE).div(r) : r;
    }
    const x = num(a), y = num(b);
    if (x < 0 && !Number.isInteger(y)) {
      // odd roots of negatives are fine: (-8)^(1/3) = -2
      const inv = 1 / y;
      if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return approx(-Math.pow(-x, y));
      throw new CalcError("not a real number");
    }
    return approx(Math.pow(x, y));
  }
  function exactRoot(a, k) {  // k-th root if a is a perfect power, else null
    if (!isQ(a) || a.sign() < 0 && k % 2 === 0) return null;
    const r = (big) => { const neg = big < 0; let x = neg ? -big : big; const f = B(Math.round(Math.pow(Number(x), 1 / k))); for (const c of [f - ONE, f, f + ONE]) if (c >= 0 && c ** B(k) === x) return neg ? -c : c; return null; };
    const n = r(a.n), d = r(a.d);
    return n !== null && d !== null ? new Q(n, d) : null;
  }
  function factorial(a) {
    if (!isQ(a) || !a.isInt() || a.n < 0) throw new CalcError("factorial needs a whole number");
    if (a.n > B(500)) throw new CalcError("too big");
    let r = ONE; for (let i = B(2); i <= a.n; i++) r *= i;
    return new Q(r);
  }
  const deg = Math.PI / 180;
  const FUNCS = {
    sqrt: (a) => { if (num(a) < 0) throw new CalcError("not a real number"); return exactRoot(a, 2) || approx(Math.sqrt(num(a))); },
    cbrt: (a) => exactRoot(a, 3) || approx(Math.cbrt(num(a))),
    abs: (a) => (isQ(a) ? (a.sign() < 0 ? a.neg() : a) : Math.abs(a)),
    round: (a) => (isQ(a) ? Q.parse(a.toDecimal(0)) : Math.round(a)),
    floor: (a) => approx(Math.floor(num(a))), ceil: (a) => approx(Math.ceil(num(a))),
    sin: (a) => approx(Math.sin(num(a) * deg)), cos: (a) => approx(Math.cos(num(a) * deg)),
    tan: (a) => { const x = num(a); if (Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) throw new CalcError("undefined"); return approx(Math.tan(x * deg)); },
    log: (a) => { if (num(a) <= 0) throw new CalcError("undefined"); return approx(Math.log10(num(a))); },
    ln: (a) => { if (num(a) <= 0) throw new CalcError("undefined"); return approx(Math.log(num(a))); },
  };

  // ---------- parser (recursive descent) ----------
  function lex(s) {
    const toks = [];
    const re = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?|(sqrt|cbrt|abs|round|floor|ceil|sin|cos|tan|log|ln|pi|π|e)\b|(\*\*|[-+*/^()!%×÷√]))/gy;
    let m, pos = 0;
    s = s.trim();
    while (pos < s.length) {
      re.lastIndex = pos;
      m = re.exec(s);
      if (!m) throw new CalcError("unexpected '" + s[pos] + "'");
      pos = re.lastIndex;
      if (m[1] !== undefined) toks.push({ t: "num", v: Q.parse(m[1] + (m[2] ? "e" + m[2] : "")) });
      else if (m[3]) toks.push(m[3] === "pi" || m[3] === "π" ? { t: "num", v: Math.PI, name: "π" } : m[3] === "e" ? { t: "num", v: Math.E, name: "e" } : { t: "fn", v: m[3] });
      else { const o = { "**": "^", "×": "*", "÷": "/", "√": "sqrt" }[m[4]] || m[4]; toks.push(o === "sqrt" ? { t: "fn", v: "sqrt" } : { t: "op", v: o }); }
      while (pos < s.length && s[pos] === " ") pos++;
    }
    return toks;
  }

  function evaluate(expr) {
    const toks = lex(expr);
    let i = 0;
    const notes = [];
    const peek = () => toks[i], next = () => toks[i++];
    const isOp = (v) => peek() && peek().t === "op" && peek().v === v;
    function parseExpr() {
      let v = parseTerm();
      while (isOp("+") || isOp("-")) {
        const o = next().v;
        const rhsStart = i;
        let r = parseTerm();
        // calculator convention: 80 + 10% means 80 + 10% of 80
        if (toks[i - 1] && toks[i - 1].pct && i - rhsStart === 2) { r = op(v, r, "mul"); notes.push("pct"); }
        v = op(v, r, o === "+" ? "add" : "sub");
      }
      return v;
    }
    function parseTerm() {
      let v = parseUnary();
      for (;;) {
        if (isOp("*") || isOp("/")) { const o = next().v; v = op(v, parseUnary(), o === "*" ? "mul" : "div"); }
        else if (isOp("%") && toks[i + 1] && (toks[i + 1].t === "num" || toks[i + 1].v === "(")) {
          next(); const r = parseUnary();
          if (!isQ(v) || !isQ(r) || !v.isInt() || !r.isInt()) throw new CalcError("remainder needs whole numbers");
          if (r.n === ZERO) throw new CalcError("divide by zero");
          v = new Q(v.n % r.n);
        } else if (peek() && ((peek().t === "num" && (peek().name || toks[i - 1].v === ")")) || peek().t === "fn" || peek().v === "(") && toks[i - 1] && (toks[i - 1].t === "num" || toks[i - 1].v === ")" || toks[i - 1].v === "!")) {
          v = op(v, parseUnary(), "mul");  // implicit multiplication: 2(3+4), 2pi
        } else break;
      }
      return v;
    }
    function parseUnary() {
      if (isOp("-")) { next(); const startsPow = toks[i] && toks[i].t === "num" && toks[i + 1] && toks[i + 1].v === "^"; const v = parseUnary(); if (startsPow) notes.push("negpow"); return isQ(v) ? v.neg() : -v; }
      if (isOp("+")) { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      let v = parsePostfix();
      if (isOp("^")) { next(); v = power(v, parseUnary()); }
      return v;
    }
    function parsePostfix() {
      let v = parsePrimary();
      for (;;) {
        if (isOp("!")) { next(); v = factorial(v); }
        else if (isOp("%") && !(toks[i + 1] && (toks[i + 1].t === "num" || toks[i + 1].v === "("))) { toks[i].pct = true; next(); v = op(v, new Q(ONE, B(100)), "mul"); }
        else break;
      }
      return v;
    }
    function parsePrimary() {
      const t = next();
      if (!t) throw new CalcError("incomplete");
      if (t.t === "num") return t.v;
      if (t.t === "fn") { const f = FUNCS[t.v]; return f(isOp("(") ? parsePrimary() : parseUnary()); }
      if (t.v === "(") { const v = parseExpr(); if (!isOp(")")) throw new CalcError("missing )"); next(); return v; }
      throw new CalcError("unexpected " + t.v);
    }
    const v = parseExpr();
    if (i < toks.length) throw new CalcError("unexpected " + toks[i].v);
    return { value: v, notes };
  }

  function withCommas(s) {
    if (s.length > 200) return s; // never format absurdly long numbers digit by digit
    const [a, b] = s.split(".");
    const neg = a.startsWith("-");
    const digits = neg ? a.slice(1) : a;
    const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : digits;
    return (neg ? "-" : "") + grouped + (b ? "." + b : "");
  }

  // 1.2345678901 × 10^60 for numbers too long to read
  function sci(v) {
    const neg = v.n < 0, n = neg ? -v.n : v.n;
    const s = (n / v.d).toString();
    if (s.length <= 40) return null;
    const exp = s.length - 1;
    const mant = s[0] + "." + s.slice(1, 11).replace(/0+$/, "");
    return (neg ? "-" : "") + mant.replace(/\.$/, "") + " × 10^" + exp;
  }
  function format(v, places) {
    if (isQ(v)) {
      const big = v.isInt() || v.finiteDecimal() ? sci(v) : null;
      if (big) return { text: big, exact: false };
      if (v.isInt() || v.finiteDecimal()) { const d = v.toDecimal(); if (d.length > 60) return { text: withCommas(v.toDecimal(10)), exact: false }; return { text: withCommas(d), exact: true }; }
      const dec = v.toDecimal(places || 10);
      const small = v.n < B(100000) && v.n > B(-100000) && v.d < B(100000);
      return { text: withCommas(dec), exact: false, fraction: small ? v.toString() : null };
    }
    let s = Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toPrecision(12).replace(/\.?0+e/, "e") : String(Number(v.toPrecision(12)));
    return { text: withCommas(s), exact: false };
  }

  // ---------- natural language -> expression ----------
  const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
    twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const SCALE = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, trillion: 1e12 };
  function wordsToNumbers(s) {
    return s.replace(/\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|a hundred|a thousand|a million)(?:[\s-]+(?:and\s+)?)?)+/g, (m) => {
      const parts = m.trim().replace(/-/g, " ").split(/\s+/).filter((w) => w !== "and" && w !== "a");
      let total = 0, cur = 0, any = false;
      for (const w of parts) {
        if (SMALL[w] !== undefined) { cur += SMALL[w]; any = true; }
        else if (w === "hundred") { cur = (cur || 1) * 100; any = true; }
        else if (SCALE[w]) { total += (cur || 1) * SCALE[w]; cur = 0; any = true; }
      }
      return any ? " " + String(total + cur) + " " : m;
    });
  }

  function toExpression(text) {
    let s = " " + text.toLowerCase().replace(/,(?=\d{3}\b)/g, "") + " ";
    s = s.replace(/\bhalf of\b/g, " 0.5 * ").replace(/\b(twice|double)\b/g, " 2 * ").replace(/\btriple\b/g, " 3 * ");
    s = wordsToNumbers(s).replace(/(\d) (?=\d{3}\b)/g, "$1");
    s = s.replace(/\bnegative\s+/g, " -").replace(/\bminus\s+(?=\d)/g, (m, off, str) => (/[\d)]\s*$/.test(str.slice(0, off)) ? " - " : " -"));
    const R = [
      [/\bsquare roots? of\b/g, " sqrt "], [/\bcube roots? of\b/g, " cbrt "], [/\babsolute value of\b/g, " abs "],
      [/\b(to the power of|raised to the power of|raised to|to the)\b/g, " ^ "], [/\bpower of\b/g, " ^ "],
      [/\bthe\s+/g, " "], [/\bplus\b|\band\b(?=\s*[-\d(])/g, " + "], [/\bminus\b|\btake away\b|\bsubtract(ed)?\b/g, " - "],
      [/\b(times|multiplied by|multiply by|x)\b(?=\s*[-\d(])/g, " * "], [/\b(divided by|over|divide by)\b/g, " / "],
      [/\bsquared\b/g, " ^ 2 "], [/\bcubed\b/g, " ^ 3 "],
      [/\b(percent|per cent)\b/g, " % "], [/%\s*of\b/g, " % * "], [/\bmod(ulo)?\b/g, " % "], [/\bfactorial of\s+(\d+)/g, " $1 ! "],
      [/(\d)\s*x\s*(?=\d)/g, "$1 * "],
    ];
    for (const [re, rep] of R) s = s.replace(re, rep);
    return s.replace(/\s+/g, " ").trim();
  }

  // Try to read a math question. Returns null if it isn't one.
  function solve(text) {
    let s = text.toLowerCase().trim().replace(/\s*[?=]+\s*$/, "").replace(/([^\d)\s])\s*!+\s*$/, "$1").replace(/\s*=\s*\?*\s*$/, "");
    const wantFraction = /\b(as a fraction|in fraction form|as fractions?|in fractions?)\b/.test(s);
    s = s.replace(/[,\s]*\b(as a fraction|in fraction form|as fractions?|in fractions?|as a decimal|in decimals?|exactly|precisely|roughly|approximately|please|pls)\b[?.!]*$/g, "").replace(/\$\s*(?=\d)/g, "").replace(/(\d)\s*(dollars|bucks|euros?|pounds sterling|usd|eur)\b/g, "$1");
    // "what's a 20% tip on $45?", "15% off 80", "8% tax on 25"
    s = s.replace(/[£€]\s*(?=\d)/g, "");
    let pm = /(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(tip|tax|discount|off|interest|vat|service charge)?\s*(?:on|of|for|from|off)\s*(\d+(?:\.\d+)?)\b/.exec(s);
    const rev = !pm && /(\d+(?:\.\d+)?)\b[^%\d]{0,50}?\b(?:with|and it has|and there'?s|and it'?s|at|minus|less)\s+(?:a |an )?(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(off|discount|tip|tax|vat)\b/.exec(s);
    if (rev) pm = [rev[0], rev[2], rev[3], rev[1]];
    if (pm && (pm[2] || /\b(tip|tax|discount|off|sale|interest)\b/.test(s))) {
      const kind = pm[2] || (/\btip\b/.test(s) ? "tip" : /\btax|vat\b/.test(s) ? "tax" : /\bdiscount|off|sale\b/.test(s) ? "discount" : "interest");
      const p = Q.parse(pm[1]), x = Q.parse(pm[3]);
      const part = p.mul(x).div(Q.parse("100"));
      const total = /discount|off/.test(kind) ? x.sub(part) : x.add(part);
      const fp = format(part, 2), ft = format(total, 2);
      const word = /discount|off/.test(kind) ? "you pay" : "the total is";
      return { expr: `${pm[1]}% of ${withCommas(x.toDecimal())}`, result: fp.text, exact: fp.exact, notes: [], value: part, extra: `, so ${word} ${ft.text}` };
    }
    // word problems: "if I have 3 apples and eat one, how many are left?"
    const w = " " + wordsToNumbers(" " + s + " ").replace(/\s+/g, " ") + " ";
    // "sara has 24 stickers and gives them equally to 4 friends. how many does each friend get?"
    let dv = /\b(?:has|have|had|got|there (?:are|were)|bought|baked|made|collected|picked) (\d+(?:\.\d+)?) ([a-z]+)\b.*?\b(?:gives?|gave|shares?|shared|splits?|divides?|divided|puts?|put|hands? out|handed out|deals?|dealt)\b.*?\b(?:equally )?(?:to|among|between|into|with) (\d+(?:\.\d+)?) ([a-z]+)\b.*\b(?:how many|how much)\b/.exec(w);
    if (dv && +dv[3] > 0) {
      const a = Q.parse(dv[1]), b = Q.parse(dv[3]), r = a.div(b);
      const whole = r.isInt();
      return { expr: `${dv[1]} ÷ ${dv[3]}`, result: whole ? withCommas(r.toDecimal()) : format(r, 2).text, exact: whole, notes: ["word", "each"], value: r, thing: dv[2], each: dv[4].replace(/s$/, ""), rem: whole ? null : String(Number(a.toDecimal()) % Number(b.toDecimal())) };
    }
    // "there are 6 bags with 4 apples in each, how many apples are there?"
    const ml = /\b(\d+(?:\.\d+)?) ([a-z]+)\b(?: with| of| that have| each with| and each has| each has)? (\d+(?:\.\d+)?) ([a-z]+)\b(?: in each| each| in every one)?.*\bhow many (?:\3 )?([a-z]+)\b/.exec(w);
    if (ml && /\b(each|every|per|in each)\b/.test(w) && ml[4].replace(/s$/, "") === ml[5].replace(/s$/, "")) {
      const r = Q.parse(ml[1]).mul(Q.parse(ml[3]));
      return { expr: `${ml[1]} × ${ml[3]}`, result: withCommas(r.toDecimal()), exact: true, notes: ["word", "total"], value: r, thing: ml[4] };
    }
    const wp = /\b(?:have|had|got|there (?:are|were)|bought|buy|start with|started with) (\d+(?:\.\d+)?) ([a-z]+)\b.*?\b(eat|ate|eats|give away|gave away|give|gave|lose|lost|loses|sell|sold|use|used|drop|dropped|throw away|threw away|take away|took away|spend|spent|break|broke|get|got|buy|bought|find|found|receive|received|win|won|add|added|pick|picked|catch|caught)(?: away)? (\d+(?:\.\d+)?)\b.*\bhow many\b/.exec(w);
    if (wp) {
      const a = Q.parse(wp[1]), b = Q.parse(wp[4]);
      const minus = /^(eat|ate|eats|give|gave|lose|lost|loses|sell|sold|use|used|drop|dropped|throw|threw|take|took|spend|spent|break|broke)/.test(wp[3]);
      const r = minus ? a.sub(b) : a.add(b);
      if (r.sign() >= 0) return { expr: `${wp[1]} ${minus ? "−" : "+"} ${wp[4]}`, result: withCommas(r.toDecimal()), exact: true, notes: ["word"], value: r, thing: wp[2], left: minus };
    }
    s = s.replace(/^(hey |so |ok |okay |pip |please |can you |could you |would you |pls |and |also |then |now )+/g, "");
    s = s.replace(/^(what(?:'s| is| are| does| do)|whats|how much (?:is|are|does)|how much|calculate|compute|solve|work out|evaluate|tell me|what do you get (?:for|if you do)|do the math(?: for)?:?|quick math:?)\s+/, "");
    s = s.replace(/\s+(equal|equals|make|makes|come to|give|gives|is)$/, "").replace(/\s+please$/, "");
    s = s.replace(/^(is|equal to|of)\s+/, "");
    const expr = toExpression(s);
    if (!/\d|pi|π/.test(expr)) return null;
    // must be only math characters and contain an operator or function
    if (!/^[\d\s.+\-*/^()!%×÷√e]*$|^[\d\s.+\-*/^()!%a-z√π]*$/.test(expr)) return null;
    if (/[a-z]/.test(expr.replace(/(\d)e([+-]?\d)/g, "$1$2").replace(/\b(sqrt|cbrt|abs|round|floor|ceil|sin|cos|tan|log|ln|pi|e)\b/g, ""))) return null;
    if (!/[-+*/^!%√]|sqrt|cbrt|abs|round|floor|ceil|sin|cos|tan|log|ln/.test(expr.replace(/^-/, ""))) return null;
    try {
      const { value, notes } = evaluate(expr);
      const f = format(value);
      const shown = /(%|\bpercent|\bper cent)\s*of\b/.test(s) ? prettyExpr(expr).replace(/% × /g, "% of ") : prettyExpr(expr);
      if (wantFraction && isQ(value)) return { expr: shown, result: value.isInt() ? f.text : value.toString(), exact: true, fraction: null, notes, value, extra: value.isInt() ? "" : ` (≈ ${withCommas(value.toDecimal(6))})` };
      return { expr: shown, result: f.text, exact: f.exact, fraction: f.fraction, notes, value };
    } catch (e) {
      if (e instanceof CalcError) return { expr: prettyExpr(expr), error: e.message };
      return null;
    }
  }
  function prettyExpr(e) {
    e = e.replace(/\bsqrt\s*/g, "√").replace(/\bcbrt\s*/g, "∛").replace(/(\d)\s+%/g, "$1%");
    return e.replace(/\*\*/g, "^").replace(/\s*\*\s*/g, " × ").replace(/\s*\/\s*/g, " ÷ ").replace(/\s*([+^])\s*/g, " $1 ").replace(/(\d|\))\s*-\s*/g, "$1 − ")
      .replace(/\s+/g, " ").replace(/\^ /g, "^").replace(/ \^/g, "^").trim();
  }

  // "which is bigger, 9.11 or 9.9?", "is 0.5 more than 0.45?"
  function compare(text) {
    const s = text.toLowerCase().replace(/[?!]+$/, "");
    const NUM = "(-?\\d+(?:\\.\\d+)?)";
    let r = new RegExp("\\b(?:which|what)(?: one)? is (bigger|larger|greater|higher|more|smaller|less|lower|lesser)[,:]?\\s*" + NUM + "\\s+or\\s+" + NUM + "\\b").exec(s) ||
      new RegExp("^" + NUM + " or " + NUM + "[,:]? (?:which|what)(?: one)? is (bigger|larger|greater|higher|more|smaller|less|lower|lesser)\\b").exec(s);
    let big, a, b;
    if (r) {
      if (/^-?\d/.test(r[1])) { a = r[1]; b = r[2]; big = !/smaller|less|lower|lesser/.test(r[3]); } else { a = r[2]; b = r[3]; big = !/smaller|less|lower|lesser/.test(r[1]); }
    } else if ((r = new RegExp("\\bis " + NUM + " (bigger|larger|greater|higher|more|smaller|less|lower) than " + NUM + "\\b").exec(s))) {
      const x = Q.parse(r[1]), y = Q.parse(r[3]);
      const d = x.sub(y).sign();
      const bigQ = !/smaller|less|lower/.test(r[2]);
      const yes = d !== 0 && (bigQ ? d > 0 : d < 0);
      return { text: d === 0 ? `They're equal: ${r[1]} = ${r[3]}.` : `${yes ? "Yes" : "No"}: ${r[1]} ${d > 0 ? ">" : "<"} ${r[3]}.` + (/\.\d/.test(r[1] + r[3]) ? ` (Compare them digit by digit: ${pad(r[1], r[3])}.)` : "") };
    } else return null;
    const x = Q.parse(a), y = Q.parse(b);
    const d = x.sub(y).sign();
    if (d === 0) return { text: `They're equal: ${a} = ${b}.` };
    const winner = (d > 0) === big ? a : b, other = winner === a ? b : a;
    return { text: `${winner} is ${big ? "bigger" : "smaller"} (${a} ${d > 0 ? ">" : "<"} ${b}).` + (/\.\d/.test(a + b) ? ` Tip: line up the decimals: ${pad(a, b)}.` : "") };
  }
  function pad(a, b) {
    const da = (a.split(".")[1] || "").length, db = (b.split(".")[1] || "").length, n = Math.max(da, db);
    const f = (x, k) => (k ? x : x + ".") + "0".repeat(n - k);
    return `${f(a, da)} vs ${f(b, db)}`;
  }

  // ---------- units (factors are exact decimals) ----------
  const UNITS = {};
  function unit(dim, factor, names) { for (const n of names.split("|")) UNITS[n] = { dim, f: Q.parse(factor), name: names.split("|")[0] }; }
  // length (metres)
  unit("len", "0.001", "millimeters|millimeter|millimetres|millimetre|mm"); unit("len", "0.01", "centimeters|centimeter|centimetres|centimetre|cm");
  unit("len", "1", "meters|meter|metres|metre|m"); unit("len", "1000", "kilometers|kilometer|kilometres|kilometre|km|kms");
  unit("len", "0.0254", "inches|inch|in"); unit("len", "0.3048", "feet|foot|ft"); unit("len", "0.9144", "yards|yard|yd|yds");
  unit("len", "1609.344", "miles|mile|mi"); unit("len", "1852", "nautical miles|nautical mile");
  // mass (kilograms)
  unit("mass", "0.000001", "milligrams|milligram|mg"); unit("mass", "0.001", "grams|gram|g"); unit("mass", "1", "kilograms|kilogram|kilos|kilo|kg|kgs");
  unit("mass", "1000", "tonnes|tonne|metric tons|metric ton"); unit("mass", "0.45359237", "pounds|pound|lbs|lb");
  unit("mass", "0.028349523125", "ounces|ounce|oz"); unit("mass", "6.35029318", "stones|stone|st");
  // volume (litres)
  unit("vol", "0.001", "milliliters|milliliter|millilitres|millilitre|ml"); unit("vol", "1", "liters|liter|litres|litre|l");
  unit("vol", "3.785411784", "gallons|gallon|gal"); unit("vol", "0.946352946", "quarts|quart|qt"); unit("vol", "0.473176473", "pints|pint|pt");
  unit("vol", "0.56826125", "imperial pints|imperial pint|uk pints|uk pint|british pints|british pint"); unit("vol", "4.54609", "imperial gallons|imperial gallon|uk gallons|uk gallon");
  unit("vol", "0.25", "metric cups|metric cup"); unit("vol", "0.0284130625", "uk fluid ounces|uk fluid ounce|imperial fluid ounces");
  unit("vol", "0.2365882365", "cups|cup"); unit("vol", "0.0295735295625", "fluid ounces|fluid ounce|fl oz");
  unit("vol", "0.01478676478125", "tablespoons|tablespoon|tbsp"); unit("vol", "0.00492892159375", "teaspoons|teaspoon|tsp");
  // time (seconds)
  unit("time", "0.001", "milliseconds|millisecond|ms"); unit("time", "1", "seconds|second|secs|sec|s"); unit("time", "60", "minutes|minute|mins|min");
  unit("time", "3600", "hours|hour|hrs|hr|h"); unit("time", "86400", "days|day"); unit("time", "604800", "weeks|week");
  unit("time", "31557600", "years|year|yrs|yr");
  // speed (m/s)
  unit("speed", "1", "meters per second|m/s"); unit("speed", "0.27777777777777777778", "kilometers per hour|km/h|kmh|kph");
  unit("speed", "0.44704", "miles per hour|mph"); unit("speed", "0.51444444444444444444", "knots|knot|kn");
  // data (bytes)
  unit("data", "1", "bytes|byte|b"); unit("data", "1000", "kilobytes|kilobyte|kb"); unit("data", "1000000", "megabytes|megabyte|mb");
  unit("data", "1000000000", "gigabytes|gigabyte|gb"); unit("data", "1000000000000", "terabytes|terabyte|tb");
  unit("data", "0.125", "bits|bit");
  // area (square metres)
  unit("area", "1", "square meters|square meter|square metres|sq m|m2|m²"); unit("area", "0.09290304", "square feet|square foot|sq ft|ft2|ft²");
  unit("area", "4046.8564224", "acres|acre"); unit("area", "10000", "hectares|hectare|ha"); unit("area", "1000000", "square kilometers|square kilometer|km2|km²");
  unit("area", "2589988.110336", "square miles|square mile|sq mi");
  // temperature handled separately
  const TEMPS = { c: "C", celsius: "C", centigrade: "C", "°c": "C", f: "F", fahrenheit: "F", "°f": "F", k: "K", kelvin: "K", kelvins: "K" };

  function toC(v, u) { return u === "C" ? v : u === "F" ? v.sub(Q.parse("32")).mul(new Q(B(5), B(9))) : v.sub(Q.parse("273.15")); }
  function fromC(v, u) { return u === "C" ? v : u === "F" ? v.mul(new Q(B(9), B(5))).add(Q.parse("32")) : v.add(Q.parse("273.15")); }
  const TNAME = { C: "°C", F: "°F", K: "K" };

  // oven gas marks (UK)
  const GAS = [[1, 140, 275], [2, 150, 300], [3, 170, 325], [4, 180, 350], [5, 190, 375], [6, 200, 400], [7, 220, 425], [8, 230, 450], [9, 240, 475]];
  function gasMark(s) {
    let r;
    if ((r = /\bgas mark (\d)\b/.exec(s)) && !/\bgas mark\s*\??\s*$/.test(s)) {
      const g = GAS.find((x) => x[0] === +r[1]);
      if (g) return { text: `Gas mark ${g[0]} is about ${g[1]}°C (${g[2]}°F), or about ${g[1] - 20}°C in a fan oven.` };
    }
    if ((r = /(-?\d+(?:\.\d+)?)\s*°?\s*(c|celsius|centigrade|f|fahrenheit)\b/.exec(s)) && /\bgas( mark)?\b/.test(s)) {
      const v = +r[1], isF = /^f/.test(r[2]);
      const best = GAS.reduce((a, g) => (Math.abs(g[isF ? 2 : 1] - v) < Math.abs(a[isF ? 2 : 1] - v) ? g : a));
      if (Math.abs(best[isF ? 2 : 1] - v) > 25) return { text: `${v}°${isF ? "F" : "C"} is outside the usual gas marks (1 to 9, about 140-240°C / 275-475°F).` };
      return { text: `${v}°${isF ? "F" : "C"} is about gas mark ${best[0]} (${best[1]}°C / ${best[2]}°F).` };
    }
    return null;
  }
  // grams per US cup for common baking ingredients (they vary with how you scoop!)
  const DENSITY = { "all purpose flour": 125, "plain flour": 125, flour: 125, "bread flour": 130, "self raising flour": 125, "self rising flour": 125, "whole wheat flour": 120,
    "granulated sugar": 200, "caster sugar": 200, sugar: 200, "brown sugar": 220, "icing sugar": 120, "powdered sugar": 120, butter: 226.8, "cocoa powder": 85, cocoa: 85,
    "rolled oats": 90, oats: 90, rice: 185, honey: 340, milk: 240, water: 237, "chocolate chips": 170, "grated cheese": 100, cheese: 100, "ground almonds": 96, "almond flour": 96, salt: 288, yogurt: 245, cream: 240, oil: 218 };
  function cupsToGrams(s) {
    const ing = Object.keys(DENSITY).sort((a, b) => b.length - a.length).find((k) => new RegExp("\\b" + k + "\\b").test(s));
    if (!ing) return null;
    let r = /(\d+(?:\.\d+)?)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp)\b.*\b(grams?|g)\b/.exec(s);
    if (r) {
      const per = /^cup/.test(r[2]) ? 1 : /^(tablespoon|tbsp)/.test(r[2]) ? 1 / 16 : 1 / 48;
      const g = Math.round(+r[1] * per * DENSITY[ing]);
      return { text: `${r[1]} ${r[2]} of ${ing} is about ${g} g. (It depends a bit on how you fill the cup, so weigh it if you can!)` };
    }
    r = /\b(?:grams?|g)\b.*?(\d+(?:\.\d+)?)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp)\b/.exec(s);
    if (r && !/(\d+(?:\.\d+)?)\s*(grams?|g)\b/.test(s)) {
      const per = /^cup/.test(r[2]) ? 1 : /^(tablespoon|tbsp)/.test(r[2]) ? 1 / 16 : 1 / 48;
      return { text: `${r[1]} ${r[2]} of ${ing} is about ${Math.round(+r[1] * per * DENSITY[ing])} g. (It depends a bit on how you fill the cup, so weigh it if you can!)` };
    }
    r = /(\d+(?:\.\d+)?)\s*(grams?|g)\b.*\b(cups?)\b/.exec(s);
    if (r) {
      const c = +r[1] / DENSITY[ing];
      return { text: `${r[1]} g of ${ing} is about ${Math.round(c * 100) / 100} cups. (Scooping changes it a little, so a scale is best.)` };
    }
    return null;
  }
  function convert(text) {
    let s = text.toLowerCase().replace(/[?!.]+$/, "").replace(/degrees?\s+/g, "").trim();
    // "2 and a quarter cups", "2 1/4 cups", "one and a half"
    s = s.replace(/\b(\d+) and (a|one) (half|quarter|third)\b/g, (x, n, a, f) => String(+n + { half: 0.5, quarter: 0.25, third: 0.3333 }[f]))
      .replace(/\b(\d+) (\d)\/(\d)\b/g, (x, n, a, b) => String(+n + +a / +b)).replace(/\b(a|one) half\b/g, "0.5").replace(/\ba quarter\b/g, "0.25")
      .replace(/(\d+(?:\.\d+)?)\s*(?:degrees?\s*)?°\s*/g, "$1 ")
      .replace(/\b(ounces?|oz|grams?|kilograms?|kg|pounds?|lbs?|millilit(?:re|er)s?|ml|lit(?:re|er)s?|pints?|quarts?|gallons?|tablespoons?|tbsp|teaspoons?|tsp)\s+of\s+(?:[a-z]+\s+){0,2}?(?=(?:in|to|into|as)\s)/g, "$1 ");
    const wantExact = /\b(exact|exactly|precise|precisely)\b/.test(s);
    const gm = gasMark(s); if (gm) return gm;
    if (/\b(cups?|tablespoons?|tbsp|teaspoons?|tsp)\b/.test(s) && /\b(grams?|g)\b/.test(s)) { const cg = cupsToGrams(s); if (cg) return cg; }
    // 6 feet 2 inches / 5'11" -> inches
    let hm = /(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|')\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:inches|inch|in|"|'')(?=\s|$|,)/.exec(s);
    let label = null;
    if (hm) { const inches = Q.parse(hm[1]).mul(Q.parse("12")).add(Q.parse(hm[2])); label = `${hm[1]} ft ${hm[2]} in`; s = s.replace(hm[0], inches.toDecimal() + " inches"); }
    const unitAlt = Object.keys(UNITS).concat(Object.keys(TEMPS)).sort((a, b) => b.length - a.length)
      .map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    // "convert 5 km to miles", "5 km in miles", "how many feet in a mile", "what is 100f in celsius"
    let m = new RegExp("(-?\\d+(?:\\.\\d+)?|a|an|one)\\s*(" + unitAlt + ")\\s+(?:to|in|into|as|=|is how many|equals how many|in how many)\\s+(" + unitAlt + ")\\b").exec(s);
    let amount, from, to;
    if (m) { amount = /^(a|an|one)$/.test(m[1]) ? "1" : m[1]; from = m[2]; to = m[3]; }
    else if ((m = new RegExp("how many\\s+(" + unitAlt + ")\\s+(?:are |is )?(?:in|per|make up|to|is|are|equals?|equal to)\\s+(?:a |an |one )?(-?\\d+(?:\\.\\d+)?)?\\s*(" + unitAlt + ")\\b").exec(s))) {
      to = m[1]; amount = m[2] || "1"; from = m[3];
    } else {
      // "I weigh 82 kg, what is that in pounds?", "my recipe says 180C, what's that in F?"
      const a = new RegExp("(?:^|[^\\w.])(-?\\d+(?:\\.\\d+)?)\\s*(" + unitAlt + ")\\b").exec(s);
      const b = new RegExp("\\b(?:in|to|into|as)\\s+(?:a |an )?(" + unitAlt + ")\\s*$").exec(s);
      if (!a || !b || a.index > b.index || !/\b(that|this|it|convert|what|how much|how many|is)\b/.test(s)) return null;
      amount = a[1]; from = a[2]; to = b[1];
    }
    const v = Q.parse(amount);
    if (TEMPS[from] && TEMPS[to]) {
      if (toC(v, TEMPS[from]).sub(Q.parse("-273.15")).sign() < 0) return { error: `${withCommas(v.toDecimal())}${TNAME[TEMPS[from]]} is colder than absolute zero (-273.15°C), the coldest possible temperature! 🥶` };
      const r = fromC(toC(v, TEMPS[from]), TEMPS[to]);
      const f = format(r, wantExact ? 4 : 2);
      return { text: `${withCommas(v.toDecimal())}${TNAME[TEMPS[from]]} ${f.exact ? "=" : "≈"} ${f.text}${TNAME[TEMPS[to]]}`, value: r };
    }
    const a = UNITS[from], b = UNITS[to];
    if (!a || !b) return null;
    if (a.dim !== b.dim) return { error: `I can't turn ${a.name} into ${b.name}: they measure different things.` };
    const r = v.mul(a.f).div(b.f);
    const one = v.n === ONE && v.d === ONE;
    const f = format(r, 4);
    let extra = "";
    // 187.96 cm in feet -> also "6 ft 2 in"
    if (b.name === "feet" && !r.isInt()) {
      const ft = r.n / r.d, inches = r.sub(new Q(ft)).mul(Q.parse("12"));
      extra = ` (that's ${ft} ft ${format(inches, 1).text} in)`;
    }
    let ft = f.text, eq = f.exact ? "=" : "≈", exactNote = "";
    if (/\.\d{3,}/.test(ft)) { if (wantExact && f.exact) exactNote = ` (exactly ${f.text})`; ft = withCommas(String(Math.round(r.toNumber() * 100) / 100)); eq = "≈"; }
    return { text: `${label || withCommas(v.toDecimal()) + " " + (one ? singular(a.name) : a.name)} ${eq} ${ft} ${r.n === r.d ? singular(b.name) : b.name}${exactNote}${extra}`, value: r };
  }
  // recipes: "one and a half times: 225 g flour, 55 g butter and 150 ml milk", "it serves 4 but I need 6"
  const ING = /(\d+(?:\.\d+)?(?:\s+\d\/\d)?|\d\/\d)\s*(grams?|g|kg|kilograms?|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|eggs?|pinch(?:es)?|cloves?|slices?)\b(?:(?:\s+of)?\s+(?:the\s+)?([a-z]+(?:\s+(?!and\b|or\b|of\b|to\b|for\b|in\b)[a-z]+)?))?/g;
  function recipeFactor(s) {
    let r;
    if ((r = /\b(\d+(?:\.\d+)?|one and a half|1 1\/2|two and a half|2 1\/2) times\b(?!\s*-?\d)(?!\s*(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b)/.exec(s)) && !/\bwhat(?:'s| is)\s+\d/.test(s)) return { f: { "one and a half": "1.5", "1 1/2": "1.5", "two and a half": "2.5", "2 1/2": "2.5" }[r[1]] || r[1] };
    if (/\b(double|twice)\b/.test(s)) return { f: "2" };
    if (/\b(triple|three times)\b/.test(s)) return { f: "3" };
    if (/\b(half|halve|halving)\b/.test(s) && !/\band a half\b/.test(s)) return { f: "0.5" };
    if ((r = /\bserves? (\d+)\b.*?\b(?:serve|feed|for|make it for|cook for|cooking for|to feed|need|want|have|making)\s+(\d+)\b/.exec(s)) && +r[1] > 0) return { f: Q.parse(r[2]).div(Q.parse(r[1])), from: r[1], to: r[2] };
    return null;
  }
  function scaleRecipe(text, last) {
    const s = text.toLowerCase().replace(/[£€$]/g, "");
    if (!/\b(recipe|times|double|triple|half|halve|serves?|serving|each|ingredients?|that|it)\b/.test(s)) return null;
    const fac = recipeFactor(s);
    if (!fac) return null;
    const f = typeof fac.f === "string" ? Q.parse(fac.f) : fac.f;
    const fText = format(f, 3).text;
    const items = [];
    let r; ING.lastIndex = 0;
    while ((r = ING.exec(s))) {
      // "2 eggs, 150 ml cream": eggs name themselves
      const what = (r[3] || "").replace(/\s+(please|thanks)$/, "");
      if (!what && !/^eggs?$/.test(r[2])) continue;
      items.push({ q: r[1], unit: r[2], what: /^eggs?$/.test(r[2]) && (!what || /^(and|or|plus|with)\b/.test(what)) ? "" : what });
    }
    const list = items.length ? items : (last && /\b(double|triple|half|halve|times|x) (that|it|this|those|them|the recipe)\b|\b(that|it|this|the recipe) (doubled|tripled|halved)\b/.test(s) && s.split(/\s+/).length <= 10 ? last : []);
    if (!list.length) {
      if (fac.from) return { text: `Multiply everything by ${fText} (${fac.to} ÷ ${fac.from} = ${fText}). 🥧 So 200 g of something becomes ${format(Q.parse("200").mul(f), 2).text} g.`, items: null };
      return null;
    }
    const scaled = list.map((it) => {
      const q = /\d \d\/\d/.test(it.q) ? Q.parse(it.q.split(" ")[0]).add(Q.parse(it.q.split(" ")[1].split("/")[0]).div(Q.parse(it.q.split("/")[1]))) : /\//.test(it.q) ? Q.parse(it.q.split("/")[0]).div(Q.parse(it.q.split("/")[1])) : Q.parse(it.q);
      const v = format(q.mul(f), 2).text;
      const unit = /^(g|grams?)$/.test(it.unit) ? "g" : /^(ml|millilit)/.test(it.unit) ? "ml" : it.unit;
      return `${v} ${v === "1" ? unit.replace(/(egg|clove|slice|cup|pinche|pound|ounce)s$/, (x) => x.replace(/s$/, "").replace(/pinche$/, "pinch")) : unit.replace(/^egg$/, "eggs")} ${it.what}`.replace(/ (eggs?) (\w+)/, " $1").trim();
    });
    return { text: `For ${fText === "2" ? "double" : fText === "0.5" ? "half" : fText + " times"} the recipe: ${scaled.length > 1 ? scaled.slice(0, -1).join(", ") + " and " + scaled[scaled.length - 1] : scaled[0]}. 🧁`, items: list.map((it) => it) };
  }
  function singular(n) { return n.replace(/(inche|foot|feet)s?$/, (x) => (x.startsWith("inch") ? "inch" : "foot")).replace(/ies$/, "y").replace(/s$/, ""); }

  // "3/4 + 1/6": fraction homework, worked the way a teacher shows it (matching bottoms, then simplify)
  function fractionSteps(text) {
    const s = text.toLowerCase().trim().replace(/[?!.=\s]+$/, "").replace(/^(?:(?:ok|okay|so|um|pip|please|pls|hey)[\s,]+)*(?:what(?:'s| is)|whats|solve|calculate|work out|what do you get for|can you do|help me with|how do i do|how do you do|do)\s+/, "").trim();
    const NUM = "(\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d+)";
    const r = new RegExp("^" + NUM + "\\s*(\\+|-|−|–|\\*|x|×|÷|plus|minus|times|divided by|of|take away)\\s*" + NUM + "$").exec(s);
    if (!r || !/\d\/\d/.test(r[1] + " " + r[3])) return null;
    const parse = (t) => {
      let m;
      if ((m = /^(\d+) (\d+)\/(\d+)$/.exec(t))) return { n: B(m[1]) * B(m[3]) + B(m[2]), d: B(m[3]), shown: t, mixed: true };
      if ((m = /^(\d+)\/(\d+)$/.exec(t))) return { n: B(m[1]), d: B(m[2]), shown: t };
      return { n: B(t), d: ONE, shown: t, whole: true };
    };
    const a = parse(r[1]), b = parse(r[3]);
    if (a.d === ZERO || b.d === ZERO) return { text: "A fraction can't have 0 on the bottom! 😅 Can you check it?" };
    const op = /^(\+|plus)$/.test(r[2]) ? "+" : /^(-|−|–|minus|take away)$/.test(r[2]) ? "−" : /^(\*|x|×|times|of)$/.test(r[2]) ? "×" : "÷";
    const fr = (n, d) => n + "/" + d;
    const g = (x, y) => { x = x < 0 ? -x : x; y = y < 0 ? -y : y; while (y) { [x, y] = [y, x % y]; } return x; };
    const steps = [`${a.shown} ${op} ${b.shown}`];
    // mixed and whole numbers become improper fractions first
    if (a.mixed || b.mixed) steps.push(`${fr(a.n, a.d)} ${op} ${fr(b.n, b.d)}`);
    let n, d, hint;
    if (op === "+" || op === "−") {
      const L = a.d / g(a.d, b.d) * b.d;
      const an = a.n * (L / a.d), bn = b.n * (L / b.d);
      if (a.d !== L || b.d !== L) steps.push(`${fr(an, L)} ${op} ${fr(bn, L)}`);
      n = op === "+" ? an + bn : an - bn; d = L;
      steps.push(fr(n, d));
      hint = a.d !== b.d && !a.whole && !b.whole ? `First I made the bottom numbers match: ${L} is the smallest number both ${a.d} and ${b.d} go into.` : a.whole || b.whole ? `A whole number is just a fraction with 1 on the bottom, so I turned it into ${({ 2: "halves", 3: "thirds", 4: "quarters", 5: "fifths", 6: "sixths", 7: "sevenths", 8: "eighths", 9: "ninths", 10: "tenths", 12: "twelfths", 100: "hundredths" })[String(L)] || L + "ths"}.` : "Same bottom number, so just add the tops.";
      if (op === "−" && a.d === b.d) hint = "Same bottom number, so just take away the tops.";
    } else if (op === "×") {
      n = a.n * b.n; d = a.d * b.d;
      steps.push(`(${a.n} × ${b.n})/(${a.d} × ${b.d})`, fr(n, d));
      hint = r[2] === "of" ? "\"Of\" means times: multiply the tops, multiply the bottoms, then simplify." : "Multiply the tops, multiply the bottoms, then simplify.";
    } else {
      if (b.n === ZERO) return { text: `${steps[0]}: you can't divide by zero! 😅` };
      steps.push(`${fr(a.n, a.d)} × ${fr(b.d, b.n)}`);
      n = a.n * b.d; d = a.d * b.n;
      steps.push(fr(n, d));
      hint = "Dividing by a fraction is the same as multiplying by it flipped upside down.";
    }
    const k = g(n, d);
    if (k > ONE) { n /= k; d /= k; steps.push(d === ONE ? String(n) : fr(n, d)); }
    else if (d === ONE) steps[steps.length - 1] = String(n);
    const neg = n < 0, an2 = neg ? -n : n;
    if (d !== ONE && an2 > d) steps.push(`${neg ? "−" : ""}${an2 / d} ${fr(an2 % d, d)}`);
    const out = steps.filter((x, i) => i === 0 || x !== steps[i - 1]).map((x) => x.replace(/^-/, "−")).join(" = ");
    const val = new Q(n, d);
    const dec = d === ONE ? "" : ` (${val.finiteDecimal() ? "=" : "≈"} ${val.toDecimal(3).replace(/^-/, "−")})`;
    return { text: `${out}${dec} ✏️ ${hint}`, value: val };
  }

  // ---------- school chemistry: molar mass, grams <-> moles ----------
  // standard atomic weights (IUPAC, rounded the way school tables print them)
  const ATOMIC = { H: "1.008", He: "4.0026", Li: "6.94", Be: "9.0122", B: "10.81", C: "12.011", N: "14.007", O: "15.999", F: "18.998", Ne: "20.180",
    Na: "22.990", Mg: "24.305", Al: "26.982", Si: "28.085", P: "30.974", S: "32.06", Cl: "35.45", Ar: "39.948", K: "39.098", Ca: "40.078",
    Sc: "44.956", Ti: "47.867", V: "50.942", Cr: "51.996", Mn: "54.938", Fe: "55.845", Co: "58.933", Ni: "58.693", Cu: "63.546", Zn: "65.38",
    Ga: "69.723", Ge: "72.630", As: "74.922", Se: "78.971", Br: "79.904", Kr: "83.798", Rb: "85.468", Sr: "87.62", Ag: "107.87", Sn: "118.71",
    I: "126.90", Xe: "131.29", Cs: "132.91", Ba: "137.33", Pt: "195.08", Au: "196.97", Hg: "200.59", Pb: "207.2", U: "238.03" };
  const COMPOUNDS = { water: "H2O", "table salt": "NaCl", salt: "NaCl", "sodium chloride": "NaCl", sugar: "C12H22O11", sucrose: "C12H22O11", glucose: "C6H12O6",
    "carbon dioxide": "CO2", "carbon monoxide": "CO", oxygen: "O2", "oxygen gas": "O2", hydrogen: "H2", "hydrogen gas": "H2", nitrogen: "N2", methane: "CH4", ammonia: "NH3",
    "baking soda": "NaHCO3", "sodium bicarbonate": "NaHCO3", ethanol: "C2H5OH", "hydrochloric acid": "HCl", "sulfuric acid": "H2SO4", "sulphuric acid": "H2SO4",
    "nitric acid": "HNO3", "acetic acid": "CH3COOH", vinegar: "CH3COOH", "calcium carbonate": "CaCO3", chalk: "CaCO3", "sodium hydroxide": "NaOH", ozone: "O3",
    propane: "C3H8", butane: "C4H10", rust: "Fe2O3", "iron oxide": "Fe2O3", "magnesium oxide": "MgO", "potassium chloride": "KCl", "calcium chloride": "CaCl2",
    "copper sulfate": "CuSO4", "silver nitrate": "AgNO3", "hydrogen peroxide": "H2O2", aspirin: "C9H8O4", caffeine: "C8H10N4O2", "calcium hydroxide": "Ca(OH)2",
    "potassium permanganate": "KMnO4", "sodium carbonate": "Na2CO3", "ammonium nitrate": "NH4NO3", "magnesium chloride": "MgCl2", "aluminum oxide": "Al2O3", "aluminium oxide": "Al2O3" };
  const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
  const pretty = (f) => f.replace(/\d/g, (d) => SUB[d]);
  function parseFormula(f) {
    // "Ca(OH)2" -> { Ca: 1, O: 2, H: 2 }
    let i = 0;
    function group() {
      const out = {};
      while (i < f.length && f[i] !== ")") {
        let part;
        if (f[i] === "(") { i++; part = group(); if (f[i] !== ")") return null; i++; }
        else { const m = /^[A-Z][a-z]?/.exec(f.slice(i)); if (!m || !ATOMIC[m[0]]) return null; i += m[0].length; part = { [m[0]]: 1 }; }
        if (!part) return null;
        const n = /^\d+/.exec(f.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length;
        for (const [el, c] of Object.entries(part)) out[el] = (out[el] || 0) + c * k;
      }
      return out;
    }
    const r = group();
    return r && i === f.length && Object.keys(r).length ? r : null;
  }
  function molarMass(formula) {
    const atoms = parseFormula(formula);
    if (!atoms) return null;
    let total = Q.parse("0");
    const parts = [];
    for (const [el, n] of Object.entries(atoms)) { total = total.add(Q.parse(ATOMIC[el]).mul(Q.parse(String(n)))); parts.push(`${n > 1 ? n + " × " : ""}${ATOMIC[el]} (${el})`); }
    return { total, parts, atoms };
  }
  function chem(text) {
    const raw = text.trim().replace(/[?!.]+$/, "");
    const low = raw.toLowerCase();
    if (!/\b(molar mass|molecular (mass|weight)|formula (mass|weight)|moles?|mol|grams? per mole|g\/mol|atoms|molecules)\b/.test(low)) return null;
    // find the substance: a formula as typed (case matters: "CO" vs "Co") or a common name
    const names = Object.keys(COMPOUNDS).sort((a, b) => b.length - a.length);
    let formula = null, name = null;
    for (const n of names) if (new RegExp("\\b" + n + "\\b").test(low)) { formula = COMPOUNDS[n]; name = n; break; }
    if (!formula) {
      const cands = raw.match(/\b(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+\b/g) || [];
      const f = cands.find((x) => /\d|[A-Z].*[A-Z]/.test(x) && parseFormula(x)) || cands.find((x) => parseFormula(x) && x.length <= 2 && /^[A-Z]/.test(x) && !/^(I|A)$/.test(x));
      if (f) formula = f;
    }
    if (!formula) return null;
    const mm = molarMass(formula);
    if (!mm) return null;
    const M = mm.total;
    const Mtxt = String(Math.round(M.toNumber() * 100) / 100);
    const Mfull = format(M, 3).text;
    const label = name ? `${U0(name)} (${pretty(formula)})` : pretty(formula);
    const show = mm.parts.length > 1 ? `${mm.parts.join(" + ")} = ${Mfull}${Mfull !== Mtxt ? " ≈ " + Mtxt : ""} g/mol` : `${Mtxt} g/mol`;
    const num = (re) => { const r = re.exec(low); return r ? r[1] : null; };
    const AV = Q.parse("6.02214076").mul(Q.parse("100000000000000000000000"));
    const g = num(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/), mol = num(/(\d+(?:\.\d+)?)\s*(?:mol|moles?)\b/);
    if (/\bhow many (moles|mol)\b/.test(low) && g) {
      const n = Q.parse(g).div(M);
      return { text: `${label}: molar mass = ${show}. So ${g} g ÷ ${Mtxt} g/mol = ${format(n, 3).text} mol${Math.abs(n.toNumber() - Math.round(n.toNumber())) < 0.01 ? ` (about ${Math.round(n.toNumber())})` : ""}. 🧪` };
    }
    if (/\bhow many (grams?|g)\b|\b(mass|weight) of \d/.test(low) && mol) {
      const w = Q.parse(mol).mul(M);
      return { text: `${label}: molar mass = ${show}. So ${mol} mol × ${Mtxt} g/mol = ${format(w, 2).text} g. 🧪` };
    }
    if (/\bhow many (molecules|atoms|particles)\b/.test(low) && (mol || g)) {
      const n = mol ? Q.parse(mol) : Q.parse(g).div(M);
      const count = n.mul(AV).toNumber();
      const sci = count.toExponential(3).replace(/e\+?(-?\d+)/, (x, e) => " × 10" + String(e).replace(/-?\d/g, (d) => ({ "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }[d])));
      const perMolecule = /\batoms\b/.test(low) ? Object.values(mm.atoms).reduce((a, b) => a + b, 0) : 1;
      const tot = (count * perMolecule).toExponential(3).replace(/e\+?(-?\d+)/, (x, e) => " × 10" + String(e).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]));
      return { text: `${mol ? mol + " mol" : `${g} g ÷ ${Mtxt} g/mol = ${format(n, 3).text} mol`}, × 6.022 × 10²³ = ${sci} molecules${perMolecule > 1 ? `, and each has ${perMolecule} atoms, so ${tot} atoms` : ""}. 🧪` };
    }
    if (/\b(molar mass|molecular (mass|weight)|formula (mass|weight)|mass of (one|1|a) mole|g\/mol|grams? per mole)\b/.test(low))
      return { text: `Molar mass of ${label}: ${show}. 🧪` };
    return null;
  }
  function U0(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- one-variable linear equations: "solve 2x + 5 = 17", "3(x - 2) = 2x + 4" ----------
  function linear(text) {
    let s = text.trim().replace(/[?!.]+$/, "").replace(/−|–/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
    const asked = /^(?:(?:ok|okay|so|um|pip|please|pls|can you|could you|help me)[\s,]+)*(?:solve|find [a-z]|what is [a-z]|work out [a-z]|what does [a-z] equal)\b/i.test(s) || /\b(solve|find [a-z]\b|for [a-z]\b)/i.test(s);
    s = s.replace(/^(?:(?:ok|okay|so|um|pip|please|pls|can you|could you|help me)[\s,]+)*(?:solve(?: for [a-z])?|find [a-z](?: if| in| when)?|what is [a-z](?: if| in| when)?|work out [a-z](?: if| in)?|what does [a-z] equal(?: if| in)?)[:\s]+/i, "").replace(/,?\s*(?:solve )?for [a-z]\s*$/i, "").replace(/\s+what is [a-z]$/i, "").trim();
    if ((s.match(/=/g) || []).length !== 1) return null;
    const vars = (s.match(/[a-z]/gi) || []).map((v) => v.toLowerCase());
    const uniq = [...new Set(vars)];
    if (uniq.length !== 1 || !/^[\d\s.+\-*/()=a-z]+$/i.test(s)) return null;
    const v = uniq[0];
    // bare "y=-59" is a coordinate, not homework
    if (!asked && !/\d\s*[a-z]|[a-z]\s*[*/+]|[+*/]\s*[a-z]|[a-z].*[a-z]|\(/i.test(s)) return null;
    const src = s.toLowerCase().replace(/\s+/g, "");
    let i = 0;
    const L = (a, b) => ({ a, b });
    const ZQ = Q.parse("0"), OQ = Q.parse("1");
    function atom() {
      let c = src[i];
      if (c === "(") { i++; const e = expr(); if (src[i] !== ")") throw 0; i++; return e; }
      if (c === "-") { i++; const e = atom(); return L(e.a.neg ? e.a.neg() : ZQ.sub(e.a), ZQ.sub(e.b)); }
      if (c === "+") { i++; return atom(); }
      const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
      if (num) { i += num[0].length; const q = Q.parse(num[0]); if (src[i] === v) { i++; return L(q, ZQ); } if (src[i] === "(") { const e = atom(); return L(q.mul(e.a), q.mul(e.b)); } return L(ZQ, q); }
      if (c === v) { i++; return L(OQ, ZQ); }
      throw 0;
    }
    function term() {
      let e = atom();
      while (src[i] === "*" || src[i] === "/" || src[i] === "(" || src[i] === v) {
        const op = src[i] === "*" || src[i] === "/" ? src[i++] : "*";
        const f = atom();
        if (op === "*") { if (e.a.sign() !== 0 && f.a.sign() !== 0) throw 0; e = e.a.sign() === 0 ? L(f.a.mul(e.b), f.b.mul(e.b)) : L(e.a.mul(f.b), e.b.mul(f.b)); }
        else { if (f.a.sign() !== 0 || f.b.sign() === 0) throw 0; e = L(e.a.div(f.b), e.b.div(f.b)); }
      }
      return e;
    }
    function expr() {
      let e = term();
      while (src[i] === "+" || src[i] === "-") { const op = src[i++]; const f = term(); e = op === "+" ? L(e.a.add(f.a), e.b.add(f.b)) : L(e.a.sub(f.a), e.b.sub(f.b)); }
      return e;
    }
    let left, right;
    try { left = expr(); if (src[i] !== "=") return null; i++; right = expr(); if (i !== src.length) return null; } catch (e) { return null; }
    const coef = left.a.sub(right.a), rhs = right.b.sub(left.b);
    const nice = (q) => { const f = format(q, 4); return (f.fraction && !f.exact ? f.fraction + " (≈ " + f.text + ")" : f.text).replace(/^-/, "−"); };
    const shown = s.replace(/\s*([=+\-*/])\s*/g, " $1 ").trim().replace(/(^|[=(]\s*)-\s+/g, "$1-").replace(/\(\s*-\s+/g, "(-").replace(/\*/g, "×").replace(/\//g, "÷").replace(/ - /g, " − ").replace(/(^|\s|\()-(?=[\da-z])/gi, "$1−").replace(/\s+/g, " ").trim();
    if (coef.sign() === 0) return { text: rhs.sign() === 0 ? `${shown}: both sides are always equal, so every number works for ${v}! ♾️` : `${shown}: there's no solution. The ${v}'s cancel out and you're left with ${nice(left.b)} = ${nice(right.b)}, which is never true.` };
    const ans = rhs.div(coef);
    // keep the unknown positive: "−2x = −8" reads better as "2x = 8"
    let k = coef, r = rhs;
    if (k.sign() < 0) { k = ZQ.sub(k); r = ZQ.sub(r); }
    const steps = [];
    const vx = (q) => (q.sub(OQ).sign() === 0 ? v : nice(q) + v);
    const unitFrac = k.n === 1n && k.d > 1n;
    if (unitFrac) { steps.push(`${v} ÷ ${k.d} = ${nice(r)}`, `${v} = ${nice(r)} × ${k.d}`); }
    else { steps.push(`${vx(k)} = ${nice(r)}`); if (k.sub(OQ).sign() !== 0) steps.push(`${v} = ${nice(r)} ÷ ${nice(k)}`); }
    steps.push(`${v} = ${nice(ans)}`);
    const norm = (x) => x.replace(/\s+/g, "");
    const uniqSteps = steps.filter((x, j) => (j === 0 ? norm(x) !== norm(shown) : x !== steps[j - 1]));
    const moved = right.a.sign() !== 0 ? `the ${v}'s to one side and the numbers to the other` : "the numbers to the other side";
    const how = unitFrac ? `, then multiplied by ${k.d}` : k.sub(OQ).sign() !== 0 ? `, then divided by ${nice(k)}` : "";
    return { text: `${shown}\n→ ${uniqSteps.join("\n→ ")}\nSo ${v} = ${nice(ans)}! ✏️ (I moved ${moved}${how}.)`, value: ans };
  }

  // ---------- kitchen: sticks of butter, cup fractions, oven temperatures ----------
  const FRAC_GLYPH = { "1/2": "½", "1/4": "¼", "3/4": "¾", "1/3": "⅓", "2/3": "⅔", "1/8": "⅛" };
  function amountOf(a) {
    a = a.trim().replace(/\s+/g, " ");
    const W = { a: "1", an: "1", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6" };
    let r;
    if ((r = /^(\d+) (\d)\/(\d)$/.exec(a))) return Q.parse(r[1]).add(Q.parse(r[2]).div(Q.parse(r[3])));
    if ((r = /^(\d+)\/(\d+)$/.exec(a))) return Q.parse(r[1]).div(Q.parse(r[2]));
    if (/^\d+(\.\d+)?$/.test(a)) return Q.parse(a);
    if ((r = /^(a|an|one|two|three|\d+) and (a|one) half$/.exec(a))) return Q.parse(W[r[1]] || r[1]).add(Q.parse("0.5"));
    if (/^(half|half a|half an|a half|one half)$/.test(a)) return Q.parse("0.5");
    if (/^(a quarter|quarter|one quarter|a quarter of a|quarter of a)$/.test(a)) return Q.parse("0.25");
    if (/^(three quarters|three quarters of a|3 quarters|three fourths)$/.test(a)) return Q.parse("0.75");
    if (/^(a third|one third|a third of a|third of a)$/.test(a)) return Q.parse("1").div(Q.parse("3"));
    if (/^(two thirds|two thirds of a|2 thirds)$/.test(a)) return Q.parse("2").div(Q.parse("3"));
    if (W[a]) return Q.parse(W[a]);
    return null;
  }
  function prettyAmount(q) {
    if (q.isInt()) return q.toString();
    const whole = q.n / q.d, rest = new Q(q.n % q.d, q.d);
    const g = FRAC_GLYPH[rest.toString()];
    if (g) return (whole > 0n ? whole.toString() : "") + g;
    return q.toDecimal(2);
  }
  function kitchen(text, lastBot) {
    const s = " " + text.toLowerCase().replace(/[?!]+/g, " ").replace(/\s+/g, " ") + " ";
    let r;
    // "how much is a stick of butter in grams?", "2 sticks of butter"
    if ((r = /\b(\d+(?:\.\d+)?|a|one|two|three|four|half a|half)\s*sticks? of butter\b/.exec(s)) || (/\bstick of butter\b/.test(s) && (r = [null, "1"]))) {
      if (/\b(grams?|g|how much|how many|weigh|ounces?|oz|cups?|tablespoons?|tbsp|in metric)\b/.test(s)) {
        const n = amountOf(r[1]) || Q.parse("1");
        const g = Math.round(n.toNumber() * 113.4);
        const one = n.sub(Q.parse("1")).sign() === 0;
        return { text: `${one ? "1 stick" : prettyAmount(n) + " sticks"} of butter = ${g} g (${one ? "½ cup, 8 tablespoons, 4 oz" : prettyAmount(n.mul(Q.parse("0.5"))) + " cup" + (n.toNumber() > 2 ? "s" : "")}). 🧈 US butter sticks are 4 oz each.` };
      }
    }
    // "how many grams is half a cup of butter? and 3/4 cup of sugar?"
    const AMT = "(\\d+ \\d/\\d|\\d+/\\d+|\\d+(?:\\.\\d+)?|a|an|one|two|three|half an?|a half|one half|half|a quarter(?: of an?)?|quarter of an?|three quarters(?: of an?)?|a third(?: of an?)?|two thirds(?: of an?)?|(?:a|one|two|\\d+) and (?:a|one) half)";
    const ING = Object.keys(DENSITY).sort((a, b) => b.length - a.length).join("|");
    const re = new RegExp("\\b" + AMT + "\\s+(cups?|tablespoons?|tbsp|teaspoons?|tsp)(?:\\s+and\\s+a\\s+half)?\\s+(?:of\\s+)?(?:the\\s+)?(" + ING + ")\\b", "g");
    const wantsGrams = /\b(grams?|g|weigh|in metric)\b/.test(s) || /\bhow (much|many)\b.*\b(grams?|g)\b/.test(s);
    if (wantsGrams && !/\b(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/.test(s)) {
      const out = [];
      let mm;
      while ((mm = re.exec(s))) {
        let n = amountOf(mm[1]);
        if (!n) continue;
        if (/\band a half\b/.test(mm[0]) && /cups?/.test(mm[2]) && !/and (a|one) half$/.test(mm[1])) n = n.add(Q.parse("0.5"));
        const per = /^cup/.test(mm[2]) ? Q.parse("1") : /^(tablespoon|tbsp)/.test(mm[2]) ? Q.parse("1").div(Q.parse("16")) : Q.parse("1").div(Q.parse("48"));
        const g = Math.round(n.mul(per).toNumber() * DENSITY[mm[3]]);
        const unit = /^cup/.test(mm[2]) ? (n.toNumber() > 1 ? "cups" : "cup") : /^(tablespoon|tbsp)/.test(mm[2]) ? "tbsp" : "tsp";
        out.push(`${prettyAmount(n)} ${unit} of ${mm[3]} ≈ ${g} g`);
      }
      if (out.length) return { text: `${U0(out.join(", and "))}. 🧁 (Cups vary a bit with how you fill them, so weigh it if you can!)` };
    }
    // oven temperatures: "bake at 350 degrees Fahrenheit, what's that in Celsius, and what if I have a fan oven?"
    const oven = /\b(bake|baking|oven|roast|preheat|cake|cookies|bread)\b/.test(s);
    if ((r = /\b(\d{3})\s*(?:°|degrees?|deg)?\s*(f|fahrenheit)\b/.exec(s)) && (oven || /\bfan\b/.test(s)) && +r[1] >= 200 && +r[1] <= 550) {
      const f = +r[1], c = (f - 32) * 5 / 9, round10 = Math.round(c / 10) * 10;
      const fan = /\bfan|convection\b/.test(s);
      return { text: `${f}°F ≈ ${Math.round(c)}°C, so most recipes say ${round10}°C.${fan ? ` In a fan oven, go about 20°C lower: around ${round10 - 20}°C.` : ""} 🔥` };
    }
    if ((r = /\b(\d{3})\s*(?:°|degrees?|deg)?\s*(c|celsius)\b/.exec(s)) && oven && /\b(fahrenheit|f|fan)\b/.test(s) && +r[1] >= 100 && +r[1] <= 300) {
      const c = +r[1], f = c * 9 / 5 + 32;
      const fan = /\bfan|convection\b/.test(s);
      return { text: `${c}°C ≈ ${Math.round(f)}°F (usually rounded to ${Math.round(f / 25) * 25}°F).${fan ? ` In a fan oven, use about ${c - 20}°C.` : ""} 🔥` };
    }
    // "and for a fan oven, should I set it lower?"
    if (/\b(fan|convection|fan[- ]assisted) oven\b/.test(s) && /\b(lower|higher|reduce|set|temperature|temp|what|how|should|adjust|change)\b/.test(s)) {
      const lt = /(\d{3})°C/.exec(lastBot || "");
      const base = lt ? Math.round(+lt[1] / 10) * 10 : null;
      return { text: `Yes: fan ovens cook hotter because the air moves, so set it about 20°C (25°F) lower${base ? `: ${base}°C becomes about ${base - 20}°C fan` : ""}. Start checking a few minutes early too. 🔥` };
    }
    return null;
  }

  P.math = { Q, evaluate, solve, convert, compare, format, toExpression, CalcError, scaleRecipe, fractionSteps, chem, molarMass, linear, kitchen };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
