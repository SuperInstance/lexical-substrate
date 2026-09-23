// Lexical substrate — the non-numeric variant of the fused attractor.
// From the jepa3 transcript: language is already a continuous topology;
// words carry no arithmetic, only relations. So the cell law is pure
// bitwise logic: the substitution gradient is an XOR difference, applied
// in place. No floats anywhere in the field.
//
// Cell layout (stride 4, u32):
//   [i+0] char_ctx  : active token bits (the Actor)
//   [i+1] char_tgt  : trailing anchor bits (the Character)
//   [i+2] variance  : f32-bitcast running mismatch energy (Q16-flavored bookkeeping)
//   [i+3] clock     : Lamport counter; join = <v,tau,sigma> semilattice
//
// The law (spec, mirrored from the transcript's linguistic shader):
//   mismatch = ctx ^ tgt                       // the substitution gradient
//   trend    = (left + right) / 2 (u32 mean)   // neighbor consensus
//   if mismatch != 0:
//     ctx <- ctx ^ (mismatch & (trend | 0x0F0F0F0F))
//     tgt <- tgt ^ ((ctx ^ tgt) >>> 4)         // slow trailing drift
//   clock++
//
// Honest limits: this is a relational toy with real algebraic structure
// (XOR forms an abelian group; the gate is a checksum, not a proof).

const STRIDE = 4;
const MASK = 0x0f0f0f0f;

function hash32(x) {
  x = x >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function popcount(x) {
  x = x >>> 0; let n = 0;
  while (x) { n += x & 1; x >>>= 1; }
  return n;
}

class Lexicon {
  constructor(words, seed = 7) {
    // words: array of strings; each becomes one token node
    this.n = words.length;
    this.seed = seed;
    this.cells = new Uint32Array(this.n * STRIDE);
    for (let i = 0; i < this.n; i++) {
      const w = words[i];
      let bits = 0;
      for (let c = 0; c < Math.min(w.length, 4); c++) bits |= (w.charCodeAt(c) << (c * 8));
      this.cells[i * STRIDE] = bits >>> 0;                 // ctx
      this.cells[i * STRIDE + 1] = (bits ^ hash32(i + seed)) >>> 0; // tgt: perturbed twin
      this.cells[i * STRIDE + 2] = 0;                      // variance energy
      this.cells[i * STRIDE + 3] = 0;                      // clock
    }
  }

  mismatch(i) {
    return (this.cells[i * STRIDE] ^ this.cells[i * STRIDE + 1]) >>> 0;
  }

  totalMismatch() {
    let t = 0;
    for (let i = 0; i < this.n; i++) t += popcount(this.mismatch(i));
    return t;
  }

  // one fused pass; inputWave optionally XORs into ctx (afferent reading)
  step(inputWave) {
    const prev = new Uint32Array(this.cells);
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE;
      let ctx = prev[o], tgt = prev[o + 1];
      if (inputWave && inputWave[i] !== undefined) ctx = (ctx ^ inputWave[i]) >>> 0;
      const left = prev[((i - 1 + this.n) % this.n) * STRIDE];
      const right = prev[((i + 1) % this.n) * STRIDE];
      const trend = ((left >>> 1) + (right >>> 1) + (left & right & 1)) >>> 0; // u32 mean, exact
      const m = (ctx ^ tgt) >>> 0;
      let v = prev[o + 2];
      if (m !== 0) {
        ctx = (ctx ^ (m & (trend | MASK))) >>> 0;
        tgt = (tgt ^ (((ctx ^ tgt) >>> 4))) >>> 0;
        v = (v + popcount(m)) >>> 0;
      }
      this.cells[o] = ctx;
      this.cells[o + 1] = tgt;
      this.cells[o + 2] = v;
      this.cells[o + 3] = (prev[o + 3] + 1) >>> 0;
    }
  }

  // <v,tau,sigma> join — same law as the numeric substrate
  merge(remote, remoteNodeId, localNodeId) {
    const rcells = remote.cells || remote; // accept a Lexicon or a bare Uint32Array
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE;
      const rc = rcells[o + 3], lc = this.cells[o + 3];
      if (rc > lc || (rc === lc && remoteNodeId > localNodeId)) {
        for (let k = 0; k < STRIDE; k++) this.cells[o + k] = rcells[o + k];
      }
    }
  }

  // FNV-1a 64-bit canary — anomaly GATE, not a halting proof.
  // Returns count of cells whose local chain hash diverges from baseline
  // after a pass; >0 means: drop this pass (do not commit).
  canary(baseline, fnvOffset = 0xcbf29ce484222325n) {
    let h = fnvOffset;
    for (let i = 0; i < this.n; i++) {
      for (let b = 0; b < 4; b++) {
        const byte = (this.cells[i * STRIDE] >>> (b * 8)) & 0xff;
        h ^= BigInt(byte);
        h = (h * 0x100000001b3n) % (1n << 64n);
      }
    }
    return { hash: h, diverged: baseline !== undefined ? h !== baseline : false };
  }
}

module.exports = { Lexicon, popcount, STRIDE };
