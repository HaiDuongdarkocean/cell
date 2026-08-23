// patch-ocr-csp — post-build patch for PaddleOCR.js / ONNX Runtime Web.
// Replaces `new Function()` calls (blocked by MV3 CSP `script-src 'self' 'wasm-unsafe-eval'`)
// with safe alternatives that don't use eval.
//
// Run after `npm run build`:
//   node scripts/patch-ocr-csp.mjs
//
// Patterns patched:
// 1. createNamedFunction — Emscripten named function wrapper
// 2. createDynCallWrapper — Emscripten dynamic call wrapper
// 3. methodCaller — Embind method caller

import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const distAssets = join(process.cwd(), 'dist', 'assets');

// === Copy worker-entry to a fixed name for runtime reference ===
// PaddleOCR.js worker mode needs a Worker URL, but Vite doesn't process
// the `new URL(...)` pattern from node_modules. We copy the hashed file
// to a fixed name `worker-entry.js` that the engine can reference.
const workerFiles = readdirSync(distAssets).filter(f => f.startsWith('worker-entry-') && f.endsWith('.js'));
if (workerFiles.length > 0) {
  copyFileSync(join(distAssets, workerFiles[0]), join(distAssets, 'worker-entry.js'));
  console.log(`  [OK] Copied ${workerFiles[0]} → worker-entry.js`);
}

// === Copy ORT WASM to unhashed name ===
// Vite adds content hashes to filenames, but ORT expects the unhashed name
// `ort-wasm-simd-threaded.jsep.wasm`. Copy the hashed file to the expected name.
const ortWasmFiles = readdirSync(distAssets).filter(f => f.startsWith('ort-wasm-simd-threaded.jsep-') && f.endsWith('.wasm'));
if (ortWasmFiles.length > 0) {
  copyFileSync(join(distAssets, ortWasmFiles[0]), join(distAssets, 'ort-wasm-simd-threaded.jsep.wasm'));
  console.log(`  [OK] Copied ${ortWasmFiles[0]} → ort-wasm-simd-threaded.jsep.wasm`);
}

// === Copy ORT MJS to dist/assets ===
// ORT dynamically imports `ort-wasm-simd-threaded.jsep.mjs` at runtime.
// Vite doesn't emit this file (it's inside the ORT bundle), so we copy it
// from node_modules to dist/assets/.
const ortMjsSrc = join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist', 'ort-wasm-simd-threaded.jsep.mjs');
if (existsSync(ortMjsSrc)) {
  copyFileSync(ortMjsSrc, join(distAssets, 'ort-wasm-simd-threaded.jsep.mjs'));
  console.log(`  [OK] Copied ort-wasm-simd-threaded.jsep.mjs from node_modules → dist/assets/`);
} else {
  console.error(`  [FAIL] ort-wasm-simd-threaded.jsep.mjs not found in node_modules!`);
}

// Exact string patterns to replace (not regex — avoids escaping issues).
const PATCHES = [
  // === worker-entry file: new Function() patterns ===
  {
    name: 'createNamedFunction (worker)',
    find: 'return new Function("body", "return function " + name + \'() {\\n    "use strict";    return body.apply(this, arguments);\\n};\\n\')(body);',
    replace: 'return (function(name, body) { var fn = function() { "use strict"; return body.apply(this, arguments); }; Object.defineProperty(fn, "name", { value: name, configurable: true }); return fn; })(name, body);',
  },
  {
    name: 'createDynCallWrapper (worker)',
    find: 'return new Function("dynCall", "rawFunction", body)(dynCall, rawFunction);',
    replace: 'return (function(dynCall, rawFunction) { var fn = function() { var a = Array.from(arguments); return dynCall.apply(null, [rawFunction].concat(a)); }; Object.defineProperty(fn, "name", { value: name, configurable: true }); return fn; })(dynCall, rawFunction);',
  },
  {
    name: 'methodCaller (worker)',
    find: 'h = new Function(Object.keys(P), B)(...Object.values(P))',
    replace: 'h = (function(P, B) { if (B.indexOf("getStringOrSymbol") >= 0) { return function(handle, methodName, destructorsRef, args) { return P.emval_returnValue(P.toReturnWire, destructorsRef, P.toValue(handle)[P.getStringOrSymbol(methodName)](args)); }; } else { return function(handle, methodName, destructorsRef, args) { return P.emval_returnValue(P.toReturnWire, destructorsRef, args); }; } })(P, B)',
  },
  // === dist (PaddleOCR main) file: Function() patterns (without `new`) ===
  // Note: backtick strings in the bundle contain ACTUAL newlines, not literal \n.
  {
    name: 'createNamedFunction (main)',
    find: 'Function(`body`,`return function `+e+`() {\n    "use strict";    return body.apply(this, arguments);\n};\n`)(t)',
    replace: '(function(e, t) { var fn = function() { "use strict"; return t.apply(this, arguments); }; Object.defineProperty(fn, "name", { value: e, configurable: true }); try{self.__debugBroadcast({kind:`named-fn`,name:e})}catch{}; return fn; })(e, t)',
  },
  {
    name: 'createDynCallWrapper (main)',
    find: 'Function(`dynCall`,`rawFunction`,a)(n,t)',
    replace: '(function(dynCall, rawFunction) { var cnt=0; return function() { cnt++; if(cnt<=5) try{self.__debugBroadcast({kind:`dyncall`,fn:rawFunction,args:arguments.length})}catch{}; var args = Array.from(arguments); var rv = dynCall.apply(null, [rawFunction].concat(args)); if(cnt<=5) try{self.__debugBroadcast({kind:`dyncall-ret`,fn:rawFunction})}catch{}; return rv; }; })(n, t)',
  },
  // === ort.bundle.min: ONNX Runtime Web methodCaller ===
  {
    name: 'methodCaller (ort.bundle)',
    find: 'n=Function(Object.keys(o),s)(...Object.values(o))',
    replace: 'n=(function(o,s){if(s.indexOf("getStringOrSymbol")>=0){return function(handle,methodName,destructorsRef,args){return o.emval_returnValue(o.toReturnWire,destructorsRef,o.toValue(handle)[o.getStringOrSymbol(methodName)](args))}}else{return function(handle,methodName,destructorsRef,args){return o.emval_returnValue(o.toReturnWire,destructorsRef,args)}}})(o,s)',
  },
  // === offscreen (OpenCV/embind): craftInvokerFunction — Pn(Function,m).apply(null,h) ===
  // Pn() is the minified new_() helper. It calls Function.apply(dummy, m) = new Function(...m), CSP-blocked.
  // Generic replacement: creates invoker closure from h values without Function().
  // NOTE: minified name was `Nn` in earlier builds, now `Pn` — both patterns below for compatibility.
  // Key fix: pass `null` to toWireType when s=false (not an array), matching original Emscripten behavior.
  {
    name: 'craftInvokerFunction (offscreen, Pn)',
    find: 'Pn(Function,m).apply(null,h)',
    replace: '(function(m,h){var tbe=h[0],inv=h[1],fn=h[2],rd=h[3],rt=h[4],cp=h[5];var ac=0;for(var i=6;i<m.length-1;i++){if(m[i].indexOf(`argType`)===0)ac++;else break}var ats=h.slice(6,6+ac);var ht=cp!==null;var hr=rt.name!==`void`;var urd=false;if(ht&&cp.destructorFunction===void 0)urd=true;for(var i=0;i<ac;i++)if(ats[i].destructorFunction===void 0){urd=true;break}try{var rv2=function(){try{if(arguments.length!==ac)tbe(`function called with `+arguments.length+` arguments, expected `+ac+` args!`);var ds=urd?[]:null;var wa=[];for(var i=0;i<ac;i++)wa.push(ats[i].toWireType(ds,arguments[i]));var ca=[];if(ht)ca.push(cp.toWireType(ds,this));for(var i=0;i<ac;i++)ca.push(wa[i]);var rv=inv.apply(null,[fn].concat(ca));if(urd)rd(ds);else{if(ht&&cp.destructorFunction!==null)cp.destructorFunction(ca[0]);for(var i=0;i<ac;i++)if(ats[i].destructorFunction!==null)ats[i].destructorFunction(wa[i])}if(hr)return rt.fromWireType(rv)}catch(e){try{self.__debugBroadcast({kind:`craft-invoker-err`,err:String(e).slice(0,200),ac,ht,hr,urd})}catch{};throw e}};try{self.__debugBroadcast({kind:`craft-invoker`,name:rt.name,ac,ht,hr})}catch{};return rv2}catch(e){try{self.__debugBroadcast({kind:`craft-invoker-setup-err`,err:String(e).slice(0,200),ac,ht,hr,urd,mLen:m.length,hLen:h.length})}catch{};throw e}})(m,h)',
  },
  {
    name: 'craftInvokerFunction (offscreen, Nn legacy)',
    find: 'Nn(Function,m).apply(null,h)',
    replace: '(function(m,h){var tbe=h[0],inv=h[1],fn=h[2],rd=h[3],rt=h[4],cp=h[5];var ac=0;for(var i=6;i<m.length-1;i++){if(m[i].indexOf(`argType`)===0)ac++;else break}var ats=h.slice(6,6+ac);var ht=cp!==null;var hr=rt.name!==`void`;var urd=false;if(ht&&cp.destructorFunction===void 0)urd=true;for(var i=0;i<ac;i++)if(ats[i].destructorFunction===void 0){urd=true;break}return function(){if(arguments.length!==ac)tbe(`function called with `+arguments.length+` arguments, expected `+ac+` args!`);var ds=urd?[]:null;var wa=[];for(var i=0;i<ac;i++)wa.push(ats[i].toWireType(ds,arguments[i]));var ca=[];if(ht)ca.push(cp.toWireType(ds,this));for(var i=0;i<ac;i++)ca.push(wa[i]);var rv=inv.apply(null,[fn].concat(ca));if(urd)rd(ds);else{if(ht&&cp.destructorFunction!==null)cp.destructorFunction(ca[0]);for(var i=0;i<ac;i++)if(ats[i].destructorFunction!==null)ats[i].destructorFunction(wa[i])}if(hr)return rt.fromWireType(rv)}})(m,h)',
  },
  // === offscreen (OpenCV/embind): methodCaller — _r(Pn(Function,a).apply(null,o)) ===
  // Same Pn(Function,...) pattern, wrapped in _r(). Generic replacement.
  {
    name: 'methodCaller (offscreen, Pn)',
    find: '_r(Pn(Function,a).apply(null,o))',
    replace: '_r((function(o){var rt=o[0],at=o.slice(1);try{return function(h,n,d,a){try{var v=[],off=0;for(var i=0;i<at.length;i++){v.push(at[i].readValueFromPointer(a+off));off+=at[i].argPackAdvance}var rv=h[n].apply(h,v);for(var i=0;i<at.length;i++)if(at[i].deleteObject)at[i].deleteObject(v[i]);if(!rt.isVoid)return rt.toWireType(d,rv)}catch(e){console.error(`[METHOD_CALLER] error:`,e);throw e}}}catch(e){console.error(`[METHOD_CALLER] setup error:`,e);throw e}})(o))',
  },
  {
    name: 'methodCaller (offscreen, Nn legacy)',
    find: '_r(Nn(Function,a).apply(null,o))',
    replace: '_r((function(o){var rt=o[0],at=o.slice(1);return function(h,n,d,a){var v=[],off=0;for(var i=0;i<at.length;i++){v.push(at[i].readValueFromPointer(a+off));off+=at[i].argPackAdvance}var rv=h[n].apply(h,v);for(var i=0;i<at.length;i++)if(at[i].deleteObject)at[i].deleteObject(v[i]);if(!rt.isVoid)return rt.toWireType(d,rv)}})(o))',
  },
  // === worker-entry (PaddleOCR worker): craftInvokerFunction — new_(Function, args1).apply(null, args2) ===
  // new_() is Emscripten's helper: constructor.apply(obj, argumentList) = new Function(...args1).
  // Replacement: build invoker closure directly from args2 without Function().
  // Key fix: pass `null` to toWireType when s=false (not an array), matching original Emscripten behavior.
  {
    name: 'craftInvokerFunction (worker-entry)',
    find: 'new_(Function, args1).apply(null, args2)',
    replace: '(function(args1, args2){var tbe=args2[0],inv=args2[1],fn=args2[2],rd=args2[3],rt=args2[4],cp=args2[5];var ac=0;for(var i=6;i<args1.length-1;i++){if(args1[i].indexOf(`argType`)===0)ac++;else break}var ats=args2.slice(6,6+ac);var ht=cp!==null;var hr=rt.name!==`void`;var urd=false;if(ht&&cp.destructorFunction===void 0)urd=true;for(var i=0;i<ac;i++)if(ats[i].destructorFunction===void 0){urd=true;break}return function(){if(arguments.length!==ac)tbe(`function called with `+arguments.length+` arguments, expected `+ac+` args!`);var ds=urd?[]:null;var wa=[];for(var i=0;i<ac;i++)wa.push(ats[i].toWireType(ds,arguments[i]));var ca=[];if(ht)ca.push(cp.toWireType(ds,this));for(var i=0;i<ac;i++)ca.push(wa[i]);var rv=inv.apply(null,[fn].concat(ca));if(urd)rd(ds);else{if(ht&&cp.destructorFunction!==null)cp.destructorFunction(ca[0]);for(var i=0;i<ac;i++)if(ats[i].destructorFunction!==null)ats[i].destructorFunction(wa[i])}if(hr)return rt.fromWireType(rv)}})(args1, args2)',
  },
  // === worker-entry (PaddleOCR worker): methodCaller (emval) — new_(Function, params).apply(null, args) ===
  {
    name: 'methodCaller (worker-entry)',
    find: 'new_(Function, params).apply(null, args)',
    replace: '(function(params, args){var rt=args[0],at=args.slice(1);return function(h,n,d,a){var v=[],off=0;for(var i=0;i<at.length;i++){v.push(at[i].readValueFromPointer(a+off));off+=at[i].argPackAdvance}var rv=h[n].apply(h,v);for(var i=0;i<at.length;i++)if(at[i].deleteObject)at[i].deleteObject(v[i]);if(!rt.isVoid)return rt.toWireType(d,rv)}})(params, args)',
  },
  // === dist (PaddleOCR main): getOpenCv() race condition fix ===
  // PaddleOCR's zn() checks `t.Mat` — if truthy, skips waiting for runtime init.
  // But @techstark/opencv-js defines Mat as a stub before WASM type binding completes,
  // so zn() resolves with unbound cv → UnboundTypeError on `new cv.Mat()`.
  // Patch: always wait for runtime init via then(), calledRun, or onRuntimeInitialized.
  {
    name: 'getOpenCv race condition (main)',
    find: 't.Mat||await new Promise(e=>{t.onRuntimeInitialized=()=>{e()}}),e=$e.default',
    replace: 'await new Promise(r=>{if(t.then)t.then(()=>r());else if(t.calledRun)r();else t.onRuntimeInitialized=()=>r()}),e=$e.default',
  },
  // === Debug: wrap OpenCV module export to detect evaluation completion ===
  // The export default n() call triggers the full module evaluation.
  // If evaluation hangs, the debugBroadcast never fires.
  {
    name: 'opencv-export-debug',
    find: 'export default n();export{n as t}',
    replace: 'export default (function(){try{self.__debugBroadcast({kind:`opencv-before-export`})}catch{};var rv=n();try{self.__debugBroadcast({kind:`opencv-after-export`,hasMat:typeof rv?.Mat})}catch{};return rv})();export{n as t}',
  },
];

let patched = 0;
let failed = 0;

for (const file of readdirSync(distAssets)) {
  if (!file.endsWith('.js')) continue;
  const filePath = join(distAssets, file);
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  const applied = [];

  for (const { name, find, replace } of PATCHES) {
    if (content.includes(find)) {
      content = content.split(find).join(replace);
      modified = true;
      applied.push(name);
      console.log(`  [OK] ${name}: patched in ${file}`);
    }
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    // Verify write persisted — re-read and check no find patterns remain.
    const verify = readFileSync(filePath, 'utf-8');
    let verifyFail = false;
    for (const { name, find } of PATCHES) {
      if (applied.includes(name) && verify.includes(find)) {
        console.error(`  [FAIL] ${name}: write verification failed in ${file} — pattern still present after write!`);
        verifyFail = true;
      }
    }
    if (verifyFail) {
      // Retry write once more — Windows Defender / antivirus may intercept.
      writeFileSync(filePath, content, 'utf-8');
      const verify2 = readFileSync(filePath, 'utf-8');
      let stillFail = false;
      for (const { name, find } of PATCHES) {
        if (applied.includes(name) && verify2.includes(find)) {
          console.error(`  [FAIL] ${name}: retry write also failed in ${file}!`);
          stillFail = true;
        }
      }
      if (stillFail) { failed++; continue; }
      console.log(`  [OK] ${file}: retry write succeeded`);
    }
    patched++;
  }
}

if (failed > 0) {
  console.error(`Done. Patched ${patched} file(s), ${failed} file(s) FAILED verification.`);
  process.exit(1);
}
console.log(`Done. Patched ${patched} file(s).`);
