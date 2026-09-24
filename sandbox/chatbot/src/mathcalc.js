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
    const [a, b] = s.split(".");
    const neg = a.startsWith("-");
    const digits = neg ? a.slice(1) : a;
    const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : digits;
    return (neg ? "-" : "") + grouped + (b ? "." + b : "");
  }

  function format(v, places) {
    if (isQ(v)) {
      if (v.isInt() || v.finiteDecimal()) return { text: withCommas(v.toDecimal()), exact: true };
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
    s = s.replace(/^(hey |so |ok |okay |pip |please |can you |could you |would you |pls )+/g, "");
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
      return { expr: prettyExpr(expr), result: f.text, exact: f.exact, fraction: f.fraction, notes, value };
    } catch (e) {
      if (e instanceof CalcError) return { expr: prettyExpr(expr), error: e.message };
      return null;
    }
  }
  function prettyExpr(e) {
    e = e.replace(/\bsqrt\s*/g, "√").replace(/\bcbrt\s*/g, "∛").replace(/(\d)\s+%/g, "$1%");
    return e.replace(/\s*\*\s*/g, " × ").replace(/\s*\/\s*/g, " ÷ ").replace(/\s*([+^])\s*/g, " $1 ").replace(/(\d|\))\s*-\s*/g, "$1 − ")
      .replace(/\s+/g, " ").replace(/\^ /g, "^").replace(/ \^/g, "^").trim();
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

  function convert(text) {
    const s = text.toLowerCase().replace(/[?!.]+$/, "").replace(/degrees?\s+/g, "").trim();
    const unitAlt = Object.keys(UNITS).concat(Object.keys(TEMPS)).sort((a, b) => b.length - a.length)
      .map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    // "convert 5 km to miles", "5 km in miles", "how many feet in a mile", "what is 100f in celsius"
    let m = new RegExp("(-?\\d+(?:\\.\\d+)?|a|an|one)\\s*(" + unitAlt + ")\\s+(?:to|in|into|as|=|is how many|equals how many|in how many)\\s+(" + unitAlt + ")\\b").exec(s);
    let amount, from, to;
    if (m) { amount = /^(a|an|one)$/.test(m[1]) ? "1" : m[1]; from = m[2]; to = m[3]; }
    else {
      m = new RegExp("how many\\s+(" + unitAlt + ")\\s+(?:are |is )?(?:in|per|make up|to)\\s+(?:a |an |one )?(-?\\d+(?:\\.\\d+)?)?\\s*(" + unitAlt + ")\\b").exec(s);
      if (!m) return null;
      to = m[1]; amount = m[2] || "1"; from = m[3];
    }
    const v = Q.parse(amount);
    if (TEMPS[from] && TEMPS[to]) {
      const r = fromC(toC(v, TEMPS[from]), TEMPS[to]);
      const f = format(r, 4);
      return { text: `${withCommas(v.toDecimal())}${TNAME[TEMPS[from]]} ${f.exact ? "=" : "≈"} ${f.text}${TNAME[TEMPS[to]]}`, value: r };
    }
    const a = UNITS[from], b = UNITS[to];
    if (!a || !b) return null;
    if (a.dim !== b.dim) return { error: `I can't turn ${a.name} into ${b.name}: they measure different things.` };
    const r = v.mul(a.f).div(b.f);
    const one = v.n === ONE && v.d === ONE;
    const f = format(r, 4);
    return { text: `${withCommas(v.toDecimal())} ${one ? singular(a.name) : a.name} ${f.exact ? "=" : "≈"} ${f.text} ${b.name}`, value: r };
  }
  function singular(n) { return n.replace(/(inche|foot|feet)s?$/, (x) => (x.startsWith("inch") ? "inch" : "foot")).replace(/ies$/, "y").replace(/s$/, ""); }

  P.math = { Q, evaluate, solve, convert, format, toExpression, CalcError };
})(typeof window !== "undefined" ? (window.Pip = window.Pip || {}) : (global.Pip = global.Pip || {}));
