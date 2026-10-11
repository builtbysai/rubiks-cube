// Test harness for the vendored Kociemba solver (vendor/cube.js + vendor/solve.js)
// Usage: node solver-test.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const dir = dirname(fileURLToPath(import.meta.url));
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['vendor/cube.js', 'vendor/solve.js']) {
  vm.runInContext(readFileSync(join(dir, f), 'utf8'), sandbox, { filename: f });
}
const Cube = sandbox.Cube;
Cube.initSolver();

function applyMoves(cube, movesStr) {
  if (!movesStr.trim()) return cube;
  for (const m of movesStr.trim().split(/\s+/)) cube.move(m);
  return cube;
}
function solvedFacelets() { return new Cube().asString(); }

let pass = 0, fail = 0;
function check(name, scramble, maxLen) {
  const cube = applyMoves(new Cube(), scramble);
  const t0 = Date.now();
  let sol;
  try { sol = cube.solve(); } catch (e) { sol = 'ERROR: ' + e.message; }
  const ms = Date.now() - t0;
  const moves = sol.startsWith('ERROR') ? [] : sol.trim().split(/\s+/).filter(Boolean);
  // verify: apply solution to scrambled cube, must reach solved
  const verify = applyMoves(new Cube(), scramble);
  applyMoves(verify, sol.startsWith('ERROR') ? '' : sol);
  const ok = !sol.startsWith('ERROR') && verify.asString() === solvedFacelets() && moves.length <= maxLen;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | scramble=[${scramble}] len=${moves.length} (max ${maxLen}) ${ms}ms | sol=[${sol}]`);
  if (!ok && !sol.startsWith('ERROR') && verify.asString() !== solvedFacelets()) {
    console.log('      ^^ SOLUTION DOES NOT SOLVE THE CUBE');
  }
}

console.log('--- short scrambles (must be optimal-ish) ---');
check('1-move R', 'R', 1);
check("1-move U'", "U'", 1);
check('1-move F2', 'F2', 1);
check('2-move R U', 'R U', 2);
check('2-move R R', 'R R', 2);   // = R2, optimal is 1
check('4-move R U R\' U\'', "R U R' U'", 4);
check('8-move sexy x2', "R U R' U' R U R' U'", 8); // inverse-length bound

console.log('--- random scrambles (length distribution) ---');
const lens = [];
for (let i = 0; i < 12; i++) {
  const cube = new Cube();
  const scr = [];
  const faces = 'URFDLB';
  let last = -1;
  for (let j = 0; j < 25; j++) {
    let f; do { f = Math.floor(Math.random() * 6); } while (f === last);
    last = f;
    scr.push(faces[f] + ["", "2", "'"][Math.floor(Math.random() * 3)]);
  }
  const scramble = scr.join(' ');
  const c2 = applyMoves(new Cube(), scramble);
  const t0 = Date.now();
  const sol = c2.solve();
  const ms = Date.now() - t0;
  const moves = sol.trim().split(/\s+/).filter(Boolean);
  const v = applyMoves(new Cube(), scramble);
  applyMoves(v, sol);
  const ok = v.asString() === solvedFacelets();
  ok ? pass++ : fail++;
  lens.push(moves.length);
  console.log(`${ok ? 'PASS' : 'FAIL'} | random#${i} len=${moves.length} ${ms}ms`);
  if (!ok) console.log('      ^^ SOLUTION DOES NOT SOLVE THE CUBE');
}
lens.sort((a, b) => a - b);
console.log(`random length: min=${lens[0]} median=${lens[Math.floor(lens.length/2)]} max=${lens[lens.length-1]}`);
console.log(`\n${pass} passed, ${fail} failed`);
