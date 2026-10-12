// Generates vendor/solver-tables.bin: the precomputed Kociemba move and
// pruning tables, so the app loads them from a static asset instead of
// computing them at runtime (Cube.initSolver took ~2s in Node, longer on
// phones).
//
// Usage: node tools/gen-solver-tables.mjs
// The script verifies the round-trip: it re-reads the .bin, deserializes it
// with vendor/solver-tables.js, and checks every table byte-for-byte
// against what was computed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(root + '/');
const Cube = require(join(root, 'vendor/cube.js'));
require(join(root, 'vendor/solve.js')); // extends the same Cube via the require cache
const loadSolverTables = require(join(root, 'vendor/solver-tables.js'));

// [assetName, rows, cols, type, nested, getTable]
const N_SLICE1 = 495, N_TWIST = 2187, N_FLIP = 2048, N_SLICE2 = 24;
const N_URFtoDLF = 20160, N_URtoDF = 20160;
const SPECS = [
  ['move/twist', N_TWIST, 18, 'u16', true, () => Cube.moveTables.twist],
  ['move/flip', N_FLIP, 18, 'u16', true, () => Cube.moveTables.flip],
  ['move/FRtoBR', 11880, 18, 'u16', true, () => Cube.moveTables.FRtoBR],
  ['move/URFtoDLF', N_URFtoDLF, 18, 'u16', true, () => Cube.moveTables.URFtoDLF],
  ['move/URtoDF', N_URtoDF, 18, 'u32', true, () => Cube.moveTables.URtoDF], // general coords up to ~665k
  ['move/URtoUL', 1320, 18, 'u16', true, () => Cube.moveTables.URtoUL],
  ['move/UBtoDF', 1320, 18, 'u16', true, () => Cube.moveTables.UBtoDF],
  ['move/mergeURtoDF', 336, 336, 'i16', true, () => Cube.moveTables.mergeURtoDF],
  ['prune/sliceTwist', Math.ceil((N_SLICE1 * N_TWIST) / 8), 1, 'u32', false, () => Cube.pruningTables.sliceTwist],
  ['prune/sliceFlip', Math.ceil((N_SLICE1 * N_FLIP) / 8), 1, 'u32', false, () => Cube.pruningTables.sliceFlip],
  ['prune/sliceURFtoDLFParity', Math.ceil((N_SLICE2 * N_URFtoDLF * 2) / 8), 1, 'u32', false, () => Cube.pruningTables.sliceURFtoDLFParity],
  ['prune/sliceURtoDFParity', Math.ceil((N_SLICE2 * N_URtoDF * 2) / 8), 1, 'u32', false, () => Cube.pruningTables.sliceURtoDFParity],
];

function flattenToTypedArray(name, rows, cols, type, nested, table) {
  const count = rows * cols;
  const Arr = type === 'u32' ? Uint32Array : type === 'i16' ? Int16Array : Uint16Array;
  const out = new Arr(count);
  if (!nested) {
    // flat plain array of slot ints
    if (table.length !== count) throw new Error(`${name}: expected ${count} slots, got ${table.length}`);
    for (let i = 0; i < count; i++) out[i] = table[i] >>> 0;
    return out;
  }
  let i = 0;
  const lo = type === 'i16' ? -32768 : 0;
  const hi = type === 'u32' ? 4294967295 : type === 'i16' ? 32767 : 65535;
  for (let r = 0; r < rows; r++) {
    const row = table[r];
    if (!row || row.length !== cols) throw new Error(`${name}: row ${r} has ${row && row.length} cols, expected ${cols}`);
    for (let c = 0; c < cols; c++) {
      const v = row[c];
      if (v < lo || v > hi) throw new Error(`${name}[${r}][${c}]=${v} out of ${type} range`);
      out[i++] = v;
    }
  }
  return out;
}

function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// --- compute ---
const t0 = Date.now();
Cube.initSolver();
const initMs = Date.now() - t0;
console.log(`initSolver: ${initMs} ms`);

// --- serialize ---
const parts = [];
const pushU32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); parts.push(b); };
const pushBytes = (b) => parts.push(b);
const pad4 = () => { const n = totalLen() % 4; if (n) parts.push(Buffer.alloc(4 - n)); };
const totalLen = () => parts.reduce((a, b) => a + b.length, 0);

pushBytes(Buffer.from('KOC1', 'ascii'));
pushU32(1); // version
pushU32(SPECS.length);

const digests = [];
for (const [name, rows, cols, type, nested, get] of SPECS) {
  const typed = flattenToTypedArray(name, rows, cols, type, nested, get());
  const data = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  digests.push([name, fnv1a(data), data.length]);
  const nameBuf = Buffer.from(name, 'ascii');
  pushU32(nameBuf.length);
  pushBytes(nameBuf);
  pad4();
  pushU32(rows);
  pushU32(cols);
  pushU32(type === 'u32' ? 4 : 2);
  pushU32(type === 'i16' ? 1 : 0);
  pushBytes(data);
  pad4();
}

const out = Buffer.concat(parts);
const outPath = join(root, 'vendor', 'solver-tables.bin');
writeFileSync(outPath, out);
console.log(`wrote ${outPath}: ${(out.length / 1048576).toFixed(2)} MB`);
for (const [name, digest, len] of digests) console.log(`  ${name}: ${len} bytes fnv1a=${digest}`);

// --- verify: re-read and deserialize with the real loader ---
const raw = new Uint8Array(readFileSync(outPath));
// snapshot digests of the computed tables before the loader overwrites them
const before = new Map(digests);
loadSolverTables(raw);
let ok = true;
for (const [name, rows, cols, type, nested] of SPECS) {
  const kind = name.slice(0, name.indexOf('/'));
  const key = name.slice(name.indexOf('/') + 1);
  const table = kind === 'move' ? Cube.moveTables[key] : Cube.pruningTables[key];
  let data;
  if (nested) {
    const Arr = type === 'u32' ? Uint32Array : type === 'i16' ? Int16Array : Uint16Array;
    const flat = new Arr(rows * cols);
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) flat[i++] = table[r][c];
    data = Buffer.from(flat.buffer);
  } else {
    data = Buffer.from(table.buffer, table.byteOffset, table.byteLength);
  }
  const digest = fnv1a(data);
  const match = before.get(name) === digest;
  if (!match) ok = false;
  console.log(`  verify ${name}: ${match ? 'MATCH' : 'MISMATCH'} (fnv1a=${digest})`);
}
if (!ok) { console.error('ROUND-TRIP VERIFICATION FAILED'); process.exit(1); }
console.log('round-trip OK: deserialized tables are byte-identical to computed tables');
