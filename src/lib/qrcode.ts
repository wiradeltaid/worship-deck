/**
 * Minimal, zero-dependency QR Code generator in TypeScript.
 * Generates ISO/IEC 18004 compliant QR Code matrices (Byte mode, Error Correction Level M).
 */

// QR Code Alignment Pattern Positions per version
const ALIGNMENT_PATTERN_TABLE: number[][] = [
  [], // V0 (dummy)
  [], // V1
  [6, 18], // V2
  [6, 22], // V3
  [6, 26], // V4
  [6, 30], // V5
  [6, 34], // V6
  [6, 22, 38], // V7
  [6, 24, 42], // V8
  [6, 26, 46], // V9
  [6, 28, 50], // V10
];

// Total data capacity and error correction info for EC Level M (Version 1 - 10)
// [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsPerBlockGroup1, numBlocksGroup2, dataCodewordsPerBlockGroup2]
const EC_LEVEL_M_SPECS: [number, number, number, number, number, number][] = [
  [0, 0, 0, 0, 0, 0], // V0
  [26, 10, 1, 16, 0, 0], // V1 (16 data bytes)
  [44, 16, 1, 28, 0, 0], // V2 (28 data bytes)
  [70, 26, 1, 44, 0, 0], // V3 (44 data bytes)
  [100, 18, 2, 32, 0, 0], // V4 (64 data bytes)
  [134, 24, 2, 43, 0, 0], // V5 (86 data bytes)
  [172, 16, 4, 27, 0, 0], // V6 (108 data bytes)
  [196, 18, 4, 31, 0, 0], // V7 (124 data bytes)
  [242, 22, 2, 38, 2, 39], // V8 (154 data bytes)
  [292, 22, 3, 36, 2, 37], // V9 (182 data bytes)
  [346, 26, 4, 43, 1, 44], // V10 (216 data bytes)
];

// Galois Field GF(256) tables (primitive polynomial 0x11D: x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP: number[] = new Array(512);
const GF_LOG: number[] = new Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val <<= 1;
    if (val & 0x100) {
      val ^= 0x11d;
    }
  }
  GF_LOG[0] = 0;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Compute Reed-Solomon generator polynomial coefficients
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Compute Reed-Solomon EC codewords
function rsCalculate(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Array(ecCount).fill(0);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[ecCount - 1 - j], factor);
    }
    remainder[ecCount - 1] = gfMul(gen[0], factor);
  }

  // Reverse to match high-to-low order
  const result: number[] = [];
  let tempRemainder = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) tempRemainder[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = tempRemainder[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        tempRemainder[i + j] ^= gfMul(gen[gen.length - 1 - j], coef);
      }
    }
  }

  for (let i = data.length; i < tempRemainder.length; i++) {
    result.push(tempRemainder[i]);
  }
  return result;
}

// Format info BCH(15, 5) mask 0x5412 (Level M, masks 0..7)
const FORMAT_INFOS: number[] = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0
];

export interface QrCodeResult {
  version: number;
  size: number;
  modules: boolean[][];
}

export function generateQrCode(text: string): QrCodeResult {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);

  // Find lowest version supporting Level M
  let version = 1;
  while (version <= 10) {
    const spec = EC_LEVEL_M_SPECS[version];
    const totalDataCapacity =
      spec[2] * spec[3] + spec[4] * spec[5];
    // Byte mode overhead: 4 bits mode + 8 bits count = 1.5 bytes.
    if (rawBytes.length + 2 <= totalDataCapacity) {
      break;
    }
    version++;
  }
  if (version > 10) {
    throw new Error(`Text too long for QR Code (max supported length ~180 bytes)`);
  }

  const spec = EC_LEVEL_M_SPECS[version];
  const totalDataBytes = spec[2] * spec[3] + spec[4] * spec[5];

  // 1. Bit Buffer assembly
  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count: 8 bits for V1-9, 16 bits for V10+ (using 8 for V1-9, 16 for V10)
  pushBits(rawBytes.length, version < 10 ? 8 : 16);
  // Data bytes
  for (let i = 0; i < rawBytes.length; i++) {
    pushBits(rawBytes[i], 8);
  }
  // Terminator: up to 4 zero bits
  const totalDataBits = totalDataBytes * 8;
  const termBits = Math.min(4, totalDataBits - bits.length);
  pushBits(0, termBits);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  // Pad bytes: 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    dataBytes.push(byte);
  }

  // 2. Error Correction partitioning
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  const ecCount = spec[1];
  let dataOffset = 0;

  // Group 1
  for (let i = 0; i < spec[2]; i++) {
    const blockData = dataBytes.slice(dataOffset, dataOffset + spec[3]);
    dataOffset += spec[3];
    blocks.push(blockData);
    ecBlocks.push(rsCalculate(blockData, ecCount));
  }
  // Group 2
  for (let i = 0; i < spec[4]; i++) {
    const blockData = dataBytes.slice(dataOffset, dataOffset + spec[5]);
    dataOffset += spec[5];
    blocks.push(blockData);
    ecBlocks.push(rsCalculate(blockData, ecCount));
  }

  // 3. Interleaving data and EC codewords
  const finalCodewords: number[] = [];
  const maxBlockLen = Math.max(spec[3], spec[5] || 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (const b of blocks) {
      if (i < b.length) {
        finalCodewords.push(b[i]);
      }
    }
  }
  for (let i = 0; i < ecCount; i++) {
    for (const ecb of ecBlocks) {
      finalCodewords.push(ecb[i]);
    }
  }

  // 4. Matrix Initialization
  const size = 17 + 4 * version;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );
  const isFunctionModule: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  function setFunction(r: number, c: number, val: boolean) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      isFunctionModule[r][c] = true;
    }
  }

  // Finder patterns at top-left, top-right, bottom-left
  function placeFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack =
            r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setFunction(row, col, isBlack);
        } else {
          // Separator
          setFunction(row, col, false);
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const alignPos = ALIGNMENT_PATTERN_TABLE[version];
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      const ar = alignPos[i];
      const ac = alignPos[j];
      // Skip if overlaps with finder patterns
      if (
        (ar < 9 && ac < 9) ||
        (ar < 9 && ac >= size - 9) ||
        (ar >= size - 9 && ac < 9)
      ) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setFunction(ar + r, ac + c, isBlack);
        }
      }
    }
  }

  // Timing patterns
  for (let c = 8; c < size - 8; c++) {
    if (!isFunctionModule[6][c]) {
      setFunction(6, c, c % 2 === 0);
    }
  }
  for (let r = 8; r < size - 8; r++) {
    if (!isFunctionModule[r][6]) {
      setFunction(r, 6, r % 2 === 0);
    }
  }

  // Dark module
  setFunction(size - 8, 8, true);

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (!isFunctionModule[8][i]) isFunctionModule[8][i] = true;
    if (!isFunctionModule[i][8]) isFunctionModule[i][8] = true;
    if (size - 1 - i < size) {
      if (!isFunctionModule[8][size - 1 - i]) isFunctionModule[8][size - 1 - i] = true;
      if (!isFunctionModule[size - 1 - i][8]) isFunctionModule[size - 1 - i][8] = true;
    }
  }

  // 5. Data placement (zigzag right to left)
  const dataBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      dataBits.push((cw >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let col = size - 1; col > 0; col -= 2) {
    // Column 6 is vertical timing pattern: skip it
    if (col === 6) col--;

    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const cCol = col - c;
        if (!isFunctionModule[row][cCol]) {
          const bit = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
          matrix[row][cCol] = bit === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // 6. Apply Mask (we use standard mask pattern 0: (r + c) % 2 === 0)
  const maskPattern = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunctionModule[r][c] && matrix[r][c] !== null) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }

  // 7. Write Format Information (Level M, Mask 0)
  const formatVal = FORMAT_INFOS[maskPattern];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatVal >> i) & 1) === 1;
    // Format bits around top-left finder
    if (i <= 5) {
      matrix[8][i] = bit;
    } else if (i === 6) {
      matrix[8][7] = bit;
    } else if (i === 7) {
      matrix[8][8] = bit;
    } else if (i === 8) {
      matrix[7][8] = bit;
    } else {
      matrix[14 - i][8] = bit;
    }

    // Second copy: bottom-left and top-right
    if (i < 8) {
      matrix[size - 1 - i][8] = bit;
    } else {
      matrix[8][size - 15 + i] = bit;
    }
  }

  // Ensure boolean[][]
  const cleanModules: boolean[][] = matrix.map((row) =>
    row.map((val) => Boolean(val))
  );

  return {
    version,
    size,
    modules: cleanModules,
  };
}
