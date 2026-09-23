# LEXICAL SUBSTRATE

**The vocabulary is the computer.** The non-numeric sibling of the
morphic attractor: a token field with no floats in the field at all —
the substitution gradient is an **XOR difference**, applied in place.

From the jepa3 synthesis: natural language is already a continuous
topology. Words carry no arithmetic, only relations, so the cell law is
pure bitwise logic. Reading a sentence is the forward pass; shifting bit
proximities is the correction pass.

## The cell (stride 4, u32)

| slot | name | role |
|------|------|------|
| `[i+0]` | `char_ctx` | active token bits — the Actor |
| `[i+1]` | `char_tgt` | trailing anchor — the Character |
| `[i+2]` | `variance` | mismatch-energy ledger (monotone, Q16-flavored) |
| `[i+3]` | `clock` | Lamport counter; merge = ⟨v,τ,σ⟩ join |

## The law (one fused pass)

```
mismatch = ctx ^ tgt                        // the substitution gradient
trend    = (left + right) / 2  (exact u32)  // neighbor consensus
if mismatch != 0:
    ctx <- ctx ^ (mismatch & (trend | 0x0F0F0F0F))
    tgt <- tgt ^ ((ctx ^ tgt) >>> 4)        // slow trailing drift
clock++
```

XOR is an abelian group, so "error" here is honest algebra, not
metaphor. The render law is `brightness = popcount(ctx & tgt) / 32` —
shared-form cells glow; divergent ones stay dark.

## What the tests pin (6/6, `node tests/test_lexicon.js`)

- determinism · clock monotonicity
- **mismatch-decay**: a repeated input wave drives total `Σ popcount(ctx^tgt)` down — the field learns the wave
- **merge**: ⟨v,τ,σ⟩ join is commutative, idempotent, and provenance-true (same law as morphic-canvas)
- **canary gate**: FNV-1a 64 chained across cells; injected chaos trips it. Honest finding baked into the test: a *fixed* baseline is a chain, not a boundary — any living field trips it. The gate must compare consecutive passes (WAL semantics), never an eternal constant.
- **variance ledger**: monotone by construction — energy is booked, never erased

## Honest limits

- Relational toy with real algebraic structure, not a claim about meaning.
- The canary is a checksum/anomaly filter, not a halting proof.
- 4-byte packing truncates tokens; the field is a lattice of cells, not a parser.

## Fleet connections

- Same ⟨v,τ,σ⟩ join as `morphic-canvas` (one merge law, two substrates).
- Canary chain = moth-ledger sealed-receipt semantics in miniature.
- Variance ledger = Q16 energy bookkeeping; cells are refuse-never-round.
- Dramaturgy mapping (Actor=ctx, Character=tgt, the contract=the gate) is the canon-essay seed — the piece writes itself from `tests/`.

## Origin

Distilled from the jepa3 transcript (the "linguistic substrate" shader
and the Negative Space Engine derivation), built as an executable
reference: spec first, claims only where tests hold them.
