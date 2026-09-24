/* Compiles tools/linear.wat into src/wasm.js (base64). Needs the "wabt" npm package:  npm install wabt */
const fs = require("fs"), path = require("path");
require("wabt")().then((wabt) => {
  const src = fs.readFileSync(path.join(__dirname, "linear.wat"), "utf8");
  const bin = Buffer.from(wabt.parseWat("linear.wat", src, { simd: true }).toBinary({}).buffer);
  const out = "/* compiled from tools/linear.wat by tools/build_wasm.js: SIMD matrix kernel used by src/neural.js */\n" +
    "(typeof window !== 'undefined' ? window : global).Pip.wasmLinear = " + JSON.stringify(bin.toString("base64")) + ";\n";
  fs.writeFileSync(path.join(__dirname, "..", "src", "wasm.js"), out);
  console.log("wrote src/wasm.js,", bin.length, "bytes of wasm");
});
