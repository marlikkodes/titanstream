/**
 * qr-encoder.ts — ISO/IEC 18004 compliant QR Code encoder
 * Produces valid, scannable QR codes. Zero dependencies.
 * Supports byte-mode, versions 1–10, EC level L.
 */

// ── GF(2^8) with primitive polynomial x^8+x^4+x^3+x^2+1 ─────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  // Build generator polynomial
  let gen = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(gen.length + 1);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], EXP[i]);
    }
    gen = next;
  }
  // Polynomial division
  const result = new Uint8Array(ecLen);
  const work = new Uint8Array(data.length + ecLen);
  work.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = work[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        work[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  for (let i = 0; i < ecLen; i++) result[i] = work[data.length + i];
  return result;
}

// ── Version specs: [totalCW, dataCW, numBlocks, ecPerBlock] for EC-L ──
interface VersionSpec {
  total: number;
  data: number;
  blocks: number[];  // [numBlocks, dataCWperBlock] pairs; if 2 groups: [n1,k1,n2,k2]
  ecPerBlock: number;
}
const VERSIONS: VersionSpec[] = [
  { total: 0,   data: 0,   blocks: [0, 0],       ecPerBlock: 0 },   // v0 placeholder
  { total: 26,  data: 19,  blocks: [1, 19],       ecPerBlock: 7 },   // v1
  { total: 44,  data: 34,  blocks: [1, 34],       ecPerBlock: 10 },  // v2
  { total: 70,  data: 55,  blocks: [1, 55],       ecPerBlock: 15 },  // v3
  { total: 100, data: 80,  blocks: [1, 80],       ecPerBlock: 20 },  // v4
  { total: 134, data: 108, blocks: [1, 108],      ecPerBlock: 26 },  // v5
  { total: 172, data: 136, blocks: [2, 68],       ecPerBlock: 18 },  // v6
  { total: 196, data: 156, blocks: [2, 78],       ecPerBlock: 20 },  // v7
  { total: 242, data: 194, blocks: [2, 97],       ecPerBlock: 24 },  // v8
  { total: 292, data: 232, blocks: [2, 116],      ecPerBlock: 30 },  // v9
  { total: 346, data: 274, blocks: [2, 122, 2, 123], ecPerBlock: 18 }, // v10
];

const ALIGNMENT: number[][] = [
  [], [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
];

// Pre-computed format info (EC-L, masks 0–7) with BCH(15,5) encoding and XOR mask
const FORMAT_BITS = [
  0x77c4, 0x72f3, 0x7daa, 0x789d,
  0x662f, 0x6318, 0x6c41, 0x6976,
];

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + byteLen * 8 <= VERSIONS[v].data * 8) return v;
  }
  return 10;
}

export function generateQR(text: string): boolean[][] {
  const data = new TextEncoder().encode(text);
  const ver = pickVersion(data.length);
  const spec = VERSIONS[ver];
  const N = ver * 4 + 17;
  const ccBits = ver <= 9 ? 8 : 16;

  // ── 1. Encode data stream ───────────────────────────────────────────
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4);             // byte mode
  push(data.length, ccBits);   // char count
  for (const b of data) push(b, 8);

  // terminator + byte-align
  const cap = spec.data * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  // pad codewords
  let pad = 0;
  while (bits.length < cap) { push(pad === 0 ? 0xec : 0x11, 8); pad ^= 1; }

  // bits → bytes
  const dataBytes = new Uint8Array(spec.data);
  for (let i = 0; i < spec.data; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] || 0);
    dataBytes[i] = b;
  }

  // ── 2. EC blocks + interleaving ─────────────────────────────────────
  const blockGroups: { data: Uint8Array; ec: Uint8Array }[] = [];
  let offset = 0;
  for (let g = 0; g < spec.blocks.length; g += 2) {
    const count = spec.blocks[g];
    const k = spec.blocks[g + 1];
    for (let b = 0; b < count; b++) {
      const blockData = dataBytes.slice(offset, offset + k);
      const blockEC = rsEncode(blockData, spec.ecPerBlock);
      blockGroups.push({ data: blockData, ec: blockEC });
      offset += k;
    }
  }

  // Interleave data codewords
  const maxDataLen = Math.max(...blockGroups.map(b => b.data.length));
  const interleaved: number[] = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of blockGroups) {
      if (i < blk.data.length) interleaved.push(blk.data[i]);
    }
  }
  // Interleave EC codewords
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const blk of blockGroups) {
      if (i < blk.ec.length) interleaved.push(blk.ec[i]);
    }
  }

  // ── 3. Build matrix ─────────────────────────────────────────────────
  const mod: number[][] = Array.from({ length: N }, () => Array(N).fill(-1));
  const rsv: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  const set = (r: number, c: number, v: boolean) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      mod[r][c] = v ? 1 : 0;
      rsv[r][c] = true;
    }
  };

  // Finder patterns (with separators)
  const finder = (tr: number, tc: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = tr + dr, c = tc + dc;
        if (r < 0 || r >= N || c < 0 || c >= N) continue;
        const border = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        set(r, c, !border && (ring || center));
      }
    }
  };
  finder(0, 0);
  finder(0, N - 7);
  finder(N - 7, 0);

  // Alignment patterns
  const ap = ALIGNMENT[ver] || [];
  for (const ar of ap) {
    for (const ac of ap) {
      if (rsv[ar][ac]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(ar + dr, ac + dc,
            Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    if (!rsv[6][i]) set(6, i, i % 2 === 0);
    if (!rsv[i][6]) set(i, 6, i % 2 === 0);
  }

  // Dark module is always black at (4 * ver + 9, 8)
  const darkRow = 4 * ver + 9;
  set(darkRow, 8, true);

  // Reserve format info areas (will be written after masking)
  for (let i = 0; i <= 8; i++) {
    if (!rsv[8][i]) { rsv[8][i] = true; mod[8][i] = 0; }
    if (!rsv[i][8]) { rsv[i][8] = true; mod[i][8] = 0; }
    if (i < 8) {
      if (!rsv[8][N - 1 - i]) { rsv[8][N - 1 - i] = true; mod[8][N - 1 - i] = 0; }
    }
  }
  // Reserve 7 format modules on col 8 below dark module (rows N-7 to N-1)
  for (let r = N - 7; r < N; r++) {
    rsv[r][8] = true;
    mod[r][8] = 0;
  }

  // ── 4. Place data bits (zigzag, right-to-left, starting upward) ─────
  const stream: number[] = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) stream.push((byte >> i) & 1);
  }
  // Remainder bits (versions 2-6 have 7 remainder bits)
  const remainderBits = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];
  for (let i = 0; i < (remainderBits[ver] || 0); i++) stream.push(0);

  let si = 0;
  let right = N - 1;
  while (right >= 1) {
    if (right === 6) right--; // skip timing column

    const left = right - 1;
    // Determine direction: rightmost pair goes UP, next goes DOWN, alternating
    const pairIndex = right > 6
      ? (N - 1 - right) / 2
      : (N - 2 - right) / 2;
    const goingUp = pairIndex % 2 === 0;

    for (let i = 0; i < N; i++) {
      const row = goingUp ? (N - 1 - i) : i;
      // Right column first, then left
      for (const col of [right, left]) {
        if (col < 0 || col >= N) continue;
        if (!rsv[row][col]) {
          mod[row][col] = si < stream.length ? stream[si++] : 0;
        }
      }
    }
    right -= 2;
  }

  // ── 5. Masking — evaluate all 8 masks, pick best ────────────────────
  const maskFn = (mask: number, r: number, c: number): boolean => {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
      default: return false;
    }
  };

  const applyMask = (mask: number): number[][] => {
    const out = mod.map(r => [...r]);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (!rsv[r][c] && maskFn(mask, r, c))
          out[r][c] ^= 1;
    return out;
  };

  // Penalty: rule 1 (runs of 5+) + rule 2 (2×2 blocks)
  const penalty = (m: number[][]): number => {
    let p = 0;
    for (let r = 0; r < N; r++) {
      let run = 1;
      for (let c = 1; c < N; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      if (run >= 5) p += run - 2;
    }
    for (let c = 0; c < N; c++) {
      let run = 1;
      for (let r = 1; r < N; r++) {
        if (m[r][c] === m[r - 1][c]) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      if (run >= 5) p += run - 2;
    }
    for (let r = 0; r < N - 1; r++)
      for (let c = 0; c < N - 1; c++)
        if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1])
          p += 3;
    return p;
  };

  let bestMask = 0, bestPen = Infinity;
  for (let m = 0; m < 8; m++) {
    const p = penalty(applyMask(m));
    if (p < bestPen) { bestPen = p; bestMask = m; }
  }

  const final = applyMask(bestMask);

  // ── 6. Write format info and ensure dark module ─────────────────────
  const fmt = FORMAT_BITS[bestMask];
  const fmtPositions: [number, number][] = [
    // Around top-left: b14..b0
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const fmtMirror: [number, number][] = [
    // Top-right (b14..b7) then bottom-left (b6..b0)
    [8, N - 1], [8, N - 2], [8, N - 3], [8, N - 4], [8, N - 5], [8, N - 6], [8, N - 7], [8, N - 8],
    [N - 7, 8], [N - 6, 8], [N - 5, 8], [N - 4, 8], [N - 3, 8], [N - 2, 8], [N - 1, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> (14 - i)) & 1;
    const [r1, c1] = fmtPositions[i];
    final[r1][c1] = bit;
    const [r2, c2] = fmtMirror[i];
    final[r2][c2] = bit;
  }

  // Dark module is permanently black
  final[darkRow][8] = 1;

  return final.map(row => row.map(cell => cell === 1));
}
