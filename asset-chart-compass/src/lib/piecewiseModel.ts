/**
 * Greedy piecewise linear approximation.
 * Translated from the user's Python `simple_greedy_piecewise`.
 *
 * Operates on cumulative returns and finds breakpoints where linear segments
 * best approximate the curve (R² target).
 */

export interface PiecewiseResult {
  /** Index positions of segment starts */
  sPos: number[];
  /** Index positions of segment ends */
  ePos: number[];
  /** The final piecewise-linear model values (same length as input) */
  model: number[];
  /** R² of the fit */
  r2: number;
}

export function greedyPiecewise(
  cumRetInput: number[],
  rsqTarget = 0.98,
  maxModels = 10
): PiecewiseResult {
  const n = cumRetInput.length;
  if (n < 2) return { sPos: [0], ePos: [0], model: [...cumRetInput], r2: 1 };

  // Work on a copy so we can nudge equal endpoints
  const CumRet = [...cumRetInput];

  let rsquare = 0;
  let nrModels = 0;
  let iteration = 1;
  let l = 0; // breakpoint candidate index

  let SPos: number[] = [];
  let EPos: number[] = [];
  let Model = new Array<number>(n).fill(0);
  const allModels: number[][] = [];

  while (rsquare < rsqTarget && nrModels < maxModels) {
    if (iteration === 1) {
      nrModels = 1;
      if (CumRet[n - 1] === CumRet[0]) CumRet[n - 1] += 1e-5;

      // linspace from first to last
      for (let i = 0; i < n; i++) {
        Model[i] = CumRet[0] + (CumRet[n - 1] - CumRet[0]) * (i / (n - 1));
      }
      SPos = [0];
      EPos = [n - 1];

      // argmax |CumRet - Model|
      l = argmaxAbs(CumRet, Model);
    } else {
      nrModels += 1;
      EPos.push(l);
      SPos.push(l);
      EPos.sort((a, b) => a - b);
      SPos.sort((a, b) => a - b);

      Model = new Array<number>(n).fill(NaN);
      for (let seg = 0; seg < SPos.length; seg++) {
        const start = SPos[seg];
        const end = EPos[seg];
        if (end > start) {
          if (CumRet[end] === CumRet[start]) CumRet[end] += 1e-5;
          const len = end - start;
          for (let j = 0; j <= len; j++) {
            Model[start + j] = CumRet[start] + (CumRet[end] - CumRet[start]) * (j / len);
          }
        }
      }

      // Fill any remaining NaN with CumRet
      for (let i = 0; i < n; i++) {
        if (isNaN(Model[i])) Model[i] = CumRet[i];
      }

      l = argmaxAbs(CumRet, Model);
    }

    // Compute R²
    const mean = CumRet.reduce((s, v) => s + v, 0) / n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (CumRet[i] - Model[i]) ** 2;
      ssTot += (CumRet[i] - mean) ** 2;
    }
    rsquare = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    allModels.push([...Model]);
    iteration += 1;
  }

  return {
    sPos: SPos,
    ePos: EPos,
    model: allModels[allModels.length - 1] ?? Model,
    r2: rsquare,
  };
}

function argmaxAbs(a: number[], b: number[]): number {
  let maxVal = -1;
  let maxIdx = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > maxVal) {
      maxVal = d;
      maxIdx = i;
    }
  }
  return maxIdx;
}
