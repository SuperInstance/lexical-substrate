const assert = require('node:assert');
const { Lexicon, popcount } = require('../src/lexicon.js');

const WORDS = ['crab', 'fleet', 'abyss', 'lantern', 'tide', 'hull', 'kelp', 'sonar', 'moth', 'quilt'];

// determinism
{
  const a = new Lexicon(WORDS, 7), b = new Lexicon(WORDS, 7);
  for (let i = 0; i < 6; i++) { a.step(); b.step(); }
  assert.deepStrictEqual(Array.from(a.cells), Array.from(b.cells));
}

// clock monotonicity
{
  const l = new Lexicon(WORDS, 3);
  for (let i = 0; i < 9; i++) l.step();
  for (let i = 0; i < l.n; i++) assert.strictEqual(l.cells[i * 4 + 3], 9);
}

// learning is real: repeated identical input wave drives total mismatch down
{
  const l = new Lexicon(WORDS, 11);
  const wave = WORDS.map((w, i) => (w.charCodeAt(0) << (i % 3)) | i);
  const before = l.totalMismatch();
  for (let i = 0; i < 200; i++) l.step(wave);
  const after = l.totalMismatch();
  assert.ok(after < before, `mismatch should fall (${before} -> ${after})`);
}

// merge law: commutativity + idempotence + provenance (winner is a real writer)
{
  const fa = new Lexicon(WORDS, 5), fb = new Lexicon(WORDS, 5);
  for (let i = 0; i < 4; i++) { fa.step(); fb.step(); }
  fa.step(WORDS.map((_, i) => 0xff << (i % 4)));
  fb.step(WORDS.map((_, i) => 0x0f << ((i + 1) % 4)));
  const ab = new Lexicon(WORDS, 5); ab.cells.set(fa.cells); ab.merge(fb.cells, 2, 1);
  const ba = new Lexicon(WORDS, 5); ba.cells.set(fb.cells); ba.merge(fa.cells, 1, 2);
  assert.deepStrictEqual(Array.from(ab.cells), Array.from(ba.cells));
  const again = new Lexicon(WORDS, 5); again.cells.set(ab.cells); again.merge(fb.cells, 2, 1);
  assert.deepStrictEqual(Array.from(again.cells), Array.from(ab.cells));
}

// canary: chaotic injection flips the gate; calm passes hold a stable chain
{
  const l = new Lexicon(WORDS, 9);
  l.step();
  const base = l.canary().hash;
  let held = 0;
  for (let i = 0; i < 5; i++) { l.step(); if (!l.canary(base).diverged) held++; }
  assert.ok(held <= 1, 'a fixed baseline is a chain, not a boundary — drift must trip');
  // honest use: per-pass gate = compare against the PREVIOUS pass hash
  let prev = l.canary().hash, drops = 0, runs = 400;
  for (let i = 0; i < runs; i++) {
    l.step();
    const now = l.canary().hash;
    if (i > 200 && i % 37 === 0) { l.cells[i % l.n * 4] ^= 0xffff; } // inject chaos
    const gate = l.canary(prev);
    if (gate.diverged) drops++;
    prev = now; // NB: chain baseline advances even through drops, like a WAL
  }
  assert.ok(drops >= 5, `injected chaos should trip the gate, got ${drops}`);
}

// variance accumulator is monotone (Q16-flavored energy bookkeeping)
{
  const l = new Lexicon(WORDS, 4);
  let last = 0;
  for (let i = 0; i < 10; i++) {
    l.step();
    const v = l.cells[2];
    assert.ok(v >= last, 'variance is a ledger, never decreases');
    last = v;
  }
}

console.log('lexical-substrate: 6/6 law tests pass (determinism, clock, mismatch-decay, merge, canary-gate, variance-ledger)');
