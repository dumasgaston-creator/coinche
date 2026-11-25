"use client";

import { useMemo } from "react";

/* ==========================================================================
   Encodeur QR Code ISO/IEC 18004 (Version 4-L : 33x33, 1 bloc, 78 octets max)
   Autonome, deterministe, sans dependance reseau externe.
   ========================================================================== */

const QR_SIZE = 33;
const DATA_CODEWORDS = 80;
const EC_CODEWORDS = 20;

const GF_EXP: number[] = [];
const GF_LOG: number[] = new Array<number>(256).fill(0);

(function initGaloisTables() {
  let val = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP.push(val);
    GF_LOG[val] = i;
    val *= 2;
    if (val >= 256) {
      val ^= 0x11d;
    }
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  const logA = GF_LOG[a] ?? 0;
  const logB = GF_LOG[b] ?? 0;
  return GF_EXP[(logA + logB) % 255] ?? 0;
}

function buildGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const factor = [1, GF_EXP[i] ?? 1];
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      const pVal = poly[j] ?? 0;
      for (let k = 0; k < factor.length; k += 1) {
        const fVal = factor[k] ?? 0;
        const current = next[j + k] ?? 0;
        next[j + k] = current ^ gfMul(pVal, fVal);
      }
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonEc(data: number[], ecLength: number): number[] {
  const gen = buildGeneratorPoly(ecLength);
  const buffer = new Array<number>(data.length + ecLength).fill(0);
  for (let i = 0; i < data.length; i += 1) {
    buffer[i] = data[i] ?? 0;
  }

  for (let i = 0; i < data.length; i += 1) {
    const coef = buffer[i] ?? 0;
    if (coef === 0) {
      continue;
    }
    for (let j = 0; j < gen.length; j += 1) {
      const gVal = gen[j] ?? 0;
      const cur = buffer[i + j] ?? 0;
      buffer[i + j] = cur ^ gfMul(gVal, coef);
    }
  }

  return buffer.slice(data.length);
}

function encodeDataCodewords(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 128 && bytes.length < 78) {
      bytes.push(code);
    }
  }

  const bits: number[] = [];
  function pushBits(value: number, count: number) {
    for (let i = count - 1; i >= 0; i -= 1) {
      bits.push((value >> i) & 1);
    }
  }

  // Mode Byte (0100) + Longueur sur 8 bits
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxBits = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b += 1) {
      byteVal = (byteVal << 1) | (bits[i + b] ?? 0);
    }
    codewords.push(byteVal);
  }

  let padToggle = true;
  while (codewords.length < DATA_CODEWORDS) {
    if (padToggle) {
      codewords.push(0xec);
    } else {
      codewords.push(0x11);
    }
    padToggle = !padToggle;
  }

  return codewords;
}

function setModule(
  grid: number[][],
  reserved: boolean[][],
  row: number,
  col: number,
  dark: boolean,
) {
  if (row < 0 || row >= QR_SIZE || col < 0 || col >= QR_SIZE) {
    return;
  }
  const gridRow = grid[row];
  const resRow = reserved[row];
  if (gridRow !== undefined && resRow !== undefined) {
    if (dark) {
      gridRow[col] = 1;
    } else {
      gridRow[col] = 0;
    }
    resRow[col] = true;
  }
}

function drawFinderPattern(
  grid: number[][],
  reserved: boolean[][],
  topRow: number,
  leftCol: number,
) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = topRow + r;
      const cc = leftCol + c;
      if (rr < 0 || rr >= QR_SIZE || cc < 0 || cc >= QR_SIZE) {
        continue;
      }
      let isDark = false;
      if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          isDark = true;
        }
      }
      setModule(grid, reserved, rr, cc, isDark);
    }
  }
}

function drawAlignmentPattern(
  grid: number[][],
  reserved: boolean[][],
  centerRow: number,
  centerCol: number,
) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      let isDark = false;
      if (
        Math.abs(r) === 2 ||
        Math.abs(c) === 2 ||
        (r === 0 && c === 0)
      ) {
        isDark = true;
      }
      setModule(grid, reserved, centerRow + r, centerCol + c, isDark);
    }
  }
}

function computeFormatBits(maskId: number): number {
  // EC Level L = 01 (bits 4..3), Mask = 0..7 (bits 2..0)
  const data = (0b01 << 3) | (maskId & 0x7);
  let rem = data << 10;
  const poly = 0x537;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((rem >> bit) & 1) !== 0) {
      rem ^= poly << (bit - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function writeFormatInfo(
  grid: number[][],
  reserved: boolean[][],
  maskId: number,
) {
  const format = computeFormatBits(maskId);
  for (let i = 0; i < 15; i += 1) {
    const bit = ((format >> i) & 1) === 1;
    // Copie 1 : autour du motif haut-gauche
    if (i < 6) {
      setModule(grid, reserved, i, 8, bit);
    } else if (i < 8) {
      setModule(grid, reserved, i + 1, 8, bit);
    } else {
      setModule(grid, reserved, 8, 14 - i, bit);
    }

    // Copie 2 : bas-gauche et haut-droit
    if (i < 8) {
      setModule(grid, reserved, 8, QR_SIZE - 1 - i, bit);
    } else {
      setModule(grid, reserved, QR_SIZE - 15 + i, 8, bit);
    }
  }
}

function evaluateMaskCondition(maskId: number, row: number, col: number): boolean {
  if (maskId === 0) {
    return (row + col) % 2 === 0;
  }
  if (maskId === 1) {
    return row % 2 === 0;
  }
  if (maskId === 2) {
    return col % 3 === 0;
  }
  if (maskId === 3) {
    return (row + col) % 3 === 0;
  }
  if (maskId === 4) {
    return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
  }
  if (maskId === 5) {
    return ((row * col) % 2) + ((row * col) % 3) === 0;
  }
  if (maskId === 6) {
    return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
  return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
}

function buildQrMatrix(text: string): number[][] {
  const dataBytes = encodeDataCodewords(text);
  const ecBytes = computeReedSolomonEc(dataBytes, EC_CODEWORDS);
  const allBytes = [...dataBytes, ...ecBytes];

  const bitStream: number[] = [];
  for (const byteVal of allBytes) {
    for (let b = 7; b >= 0; b -= 1) {
      bitStream.push((byteVal >> b) & 1);
    }
  }
  // 7 bits de reste pour la version 4
  for (let i = 0; i < 7; i += 1) {
    bitStream.push(0);
  }

  const baseGrid: number[][] = [];
  const reserved: boolean[][] = [];
  for (let r = 0; r < QR_SIZE; r += 1) {
    baseGrid.push(new Array<number>(QR_SIZE).fill(0));
    reserved.push(new Array<boolean>(QR_SIZE).fill(false));
  }

  drawFinderPattern(baseGrid, reserved, 0, 0);
  drawFinderPattern(baseGrid, reserved, 0, QR_SIZE - 7);
  drawFinderPattern(baseGrid, reserved, QR_SIZE - 7, 0);

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(baseGrid, reserved, 6, i, dark);
    setModule(baseGrid, reserved, i, 6, dark);
  }

  drawAlignmentPattern(baseGrid, reserved, 26, 26);
  // Module sombre obligatoire en (4*V + 9, 8) = (25, 8)
  setModule(baseGrid, reserved, 25, 8, true);

  // Reserve les zones de format avant placement des donnees
  writeFormatInfo(baseGrid, reserved, 0);

  // Placement zigzag des bits de donnees
  let bitIndex = 0;
  let goingUp = true;
  let col = QR_SIZE - 1;

  while (col > 0) {
    if (col === 6) {
      col -= 1;
    }

    for (let step = 0; step < QR_SIZE; step += 1) {
      let row = step;
      if (goingUp) {
        row = QR_SIZE - 1 - step;
      }

      for (let offset = 0; offset < 2; offset += 1) {
        const targetCol = col - offset;
        const resRow = reserved[row];
        const gridRow = baseGrid[row];
        if (
          resRow !== undefined &&
          gridRow !== undefined &&
          resRow[targetCol] === false
        ) {
          const bit = bitStream[bitIndex] ?? 0;
          bitIndex += 1;
          gridRow[targetCol] = bit;
        }
      }
    }

    goingUp = !goingUp;
    col -= 2;
  }

  // Choix simple de masque avec penalite minimale (masque 0..7)
  let bestMask = 0;
  let bestScore = Number.MAX_SAFE_INTEGER;
  let bestGrid: number[][] = baseGrid;

  for (let maskId = 0; maskId < 8; maskId += 1) {
    const candidate = baseGrid.map((rowArr, r) =>
      rowArr.map((cell, c) => {
        const resRow = reserved[r];
        if (resRow !== undefined && resRow[c] === true) {
          return cell;
        }
        if (evaluateMaskCondition(maskId, r, c)) {
          if (cell === 1) {
            return 0;
          }
          return 1;
        }
        return cell;
      }),
    );

    writeFormatInfo(candidate, reserved, maskId);

    // Calcul de penalite sur l'equilibre clair/sombre et les motifs
    let darkCount = 0;
    for (let r = 0; r < QR_SIZE; r += 1) {
      const rowRef = candidate[r];
      if (rowRef === undefined) {
        continue;
      }
      for (let c = 0; c < QR_SIZE; c += 1) {
        if (rowRef[c] === 1) {
          darkCount += 1;
        }
      }
    }
    const ratio = Math.abs((darkCount * 100) / (QR_SIZE * QR_SIZE) - 50);
    let score = Math.floor(ratio / 5) * 10;

    for (let r = 0; r < QR_SIZE - 1; r += 1) {
      const rowA = candidate[r];
      const rowB = candidate[r + 1];
      if (rowA === undefined || rowB === undefined) {
        continue;
      }
      for (let c = 0; c < QR_SIZE - 1; c += 1) {
        const v = rowA[c];
        if (v === rowA[c + 1] && v === rowB[c] && v === rowB[c + 1]) {
          score += 3;
        }
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestMask = maskId;
      bestGrid = candidate;
    }
  }

  writeFormatInfo(bestGrid, reserved, bestMask);
  return bestGrid;
}

export function QrCodeSvg(props: { value: string; size?: number }) {
  const pxSize = props.size ?? 156;
  const matrix = useMemo(() => buildQrMatrix(props.value), [props.value]);

  const rects: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (row === undefined) {
      continue;
    }
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === 1) {
        rects.push({ x: c + 2, y: r + 2 });
      }
    }
  }

  const viewBoxSize = QR_SIZE + 4;

  return (
    <svg
      width={pxSize}
      height={pxSize}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code d'accès à ${props.value}`}
      style={{
        display: "block",
        borderRadius: "8px",
        backgroundColor: "#FFFDF8",
      }}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#FFFDF8" />
      {rects.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill="#161210"
        />
      ))}
    </svg>
  );
}
