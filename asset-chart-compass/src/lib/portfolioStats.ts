export interface PortfolioStats {
  label: string;
  totalReturn: number;
  annualizedReturn: number;
  annualizedVol: number;
  maxDrawdowns: { peak: string; trough: string; recovery: string | null; drawdown: number }[];
  drawdownLabel?: string;
}

/**
 * Compute stats from a cumulative-return series (% values).
 * dates[] and cumReturns[] must be same length.
 */
/**
 * Compute stats using another series' drawdown periods.
 * For each reference drawdown period (peak→trough), compute
 * this asset's return over that same date window.
 */
export function computeStatsRelativeDrawdowns(
  label: string,
  dates: string[],
  cumReturns: number[],
  referenceStats: PortfolioStats
): PortfolioStats {
  const n = cumReturns.length;
  if (n < 2) {
    return { label, totalReturn: 0, annualizedReturn: 0, annualizedVol: 0, maxDrawdowns: [] };
  }

  const base = computeStats(label, dates, cumReturns, 0); // 0 drawdowns – we'll override

  // Map date → index for quick lookup
  const dateIdx: Record<string, number> = {};
  for (let i = 0; i < dates.length; i++) dateIdx[dates[i]] = i;

  const equity = cumReturns.map((r) => 1 + r / 100);

  const maxDrawdowns = referenceStats.maxDrawdowns.map((dd) => {
    const pi = dateIdx[dd.peak];
    const ti = dateIdx[dd.trough];
    if (pi == null || ti == null || equity[pi] === 0) {
      return { peak: dd.peak, trough: dd.trough, recovery: dd.recovery, drawdown: 0 };
    }
    const drawdown = Math.round((equity[ti] / equity[pi] - 1) * 10000) / 100;
    return { peak: dd.peak, trough: dd.trough, recovery: dd.recovery, drawdown };
  });

  return { ...base, maxDrawdowns, drawdownLabel: "During Portfolio Drawdowns" };
}

export function computeStats(
  label: string,
  dates: string[],
  cumReturns: number[],
  topN = 3
): PortfolioStats {
  const n = cumReturns.length;
  if (n < 2) {
    return { label, totalReturn: 0, annualizedReturn: 0, annualizedVol: 0, maxDrawdowns: [] };
  }

  const totalReturn = cumReturns[n - 1];

  // Annualised return
  const daySpan =
    (new Date(dates[n - 1]).getTime() - new Date(dates[0]).getTime()) / (1000 * 60 * 60 * 24);
  const years = daySpan / 365.25;
  const annualizedReturn =
    years > 0 ? (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100 : totalReturn;

  // Daily returns from cumulative
  const dailyRets: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = 1 + cumReturns[i - 1] / 100;
    const curr = 1 + cumReturns[i] / 100;
    dailyRets.push(prev !== 0 ? (curr / prev - 1) : 0);
  }

  // Annualised volatility
  const mean = dailyRets.reduce((s, v) => s + v, 0) / dailyRets.length;
  const variance = dailyRets.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyRets.length;
  const annualizedVol = Math.sqrt(variance * 252) * 100;

  // Max drawdowns – find all drawdown periods
  const equity = cumReturns.map((r) => 1 + r / 100);
  const drawdowns: { peakIdx: number; troughIdx: number; recoveryIdx: number | null; dd: number }[] = [];

  let peakIdx = 0;
  let peakVal = equity[0];
  let troughIdx = 0;
  let troughVal = equity[0];
  let inDrawdown = false;

  for (let i = 1; i < equity.length; i++) {
    if (equity[i] >= peakVal) {
      if (inDrawdown) {
        drawdowns.push({
          peakIdx,
          troughIdx,
          recoveryIdx: i,
          dd: (troughVal / equity[peakIdx] - 1) * 100,
        });
        inDrawdown = false;
      }
      peakIdx = i;
      peakVal = equity[i];
      troughIdx = i;
      troughVal = equity[i];
    } else {
      inDrawdown = true;
      if (equity[i] < troughVal) {
        troughIdx = i;
        troughVal = equity[i];
      }
    }
  }
  // Capture ongoing drawdown
  if (inDrawdown) {
    drawdowns.push({
      peakIdx,
      troughIdx,
      recoveryIdx: null,
      dd: (troughVal / equity[peakIdx] - 1) * 100,
    });
  }

  // Sort by magnitude (most negative first)
  drawdowns.sort((a, b) => a.dd - b.dd);

  const maxDrawdowns = drawdowns.slice(0, topN).map((d) => ({
    peak: dates[d.peakIdx],
    trough: dates[d.troughIdx],
    recovery: d.recoveryIdx != null ? dates[d.recoveryIdx] : null,
    drawdown: Math.round(d.dd * 100) / 100,
  }));

  return {
    label,
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    annualizedVol: Math.round(annualizedVol * 100) / 100,
    maxDrawdowns,
  };
}
