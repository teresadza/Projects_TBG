"""Split index histories into market regimes and compare indices regime by regime.

A piecewise linear trend is fitted to the log of each index's growth of $1, so
a 20% fall counts the same in 2001 as in 2021. Breakpoints are added greedily
at the month furthest from the current fit until R² reaches the target or the
segment limit. --level fits growth of $1 directly instead. Each segment is then measured for the index
and for every other index over the same dates.

Usage:
    python src/regimes.py                         # actual index data in data/
    python src/regimes.py --levels my_levels.csv  # your own month-end levels
    python src/regimes.py --levels data/synthetic/index_levels.csv --truth data/synthetic/true_regimes.csv \
        --truth-label "True bear markets"         # synthetic validation run
    python src/regimes.py --level                 # fit growth of $1 instead of its log
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RSQ_TARGET = 0.99         # log fit
RSQ_TARGET_LEVEL = 0.98   # level fit
MAX_SEGMENTS = 15
MIN_MONTHS_TO_ANNUALISE = 12


# ---------------------------------------------------------------- model
def greedy_piecewise(y: np.ndarray, rsq_target: float = RSQ_TARGET, max_segments: int = MAX_SEGMENTS):
    """Return (breakpoint indices including both ends, fitted values, R²)."""
    n = len(y)
    breaks = [0, n - 1]
    ss_tot = float(((y - y.mean()) ** 2).sum())
    while True:
        fit = np.empty(n)
        for a, b in zip(breaks, breaks[1:]):
            fit[a:b + 1] = np.linspace(y[a], y[b], b - a + 1)
        r2 = 1 - float(((y - fit) ** 2).sum()) / ss_tot if ss_tot else 1.0
        if r2 >= rsq_target or len(breaks) - 1 >= max_segments:
            return breaks, fit, r2
        gap = np.abs(y - fit)
        gap[breaks] = -1                      # never pick an existing breakpoint
        breaks = sorted(breaks + [int(np.argmax(gap))])


# ---------------------------------------------------------------- segment statistics
def segment_stats(levels: np.ndarray, a: int, b: int) -> dict:
    """Statistics for the months after index a up to and including index b.

    The month at a breakpoint belongs to the segment it ends, so no month is
    counted twice. Short segments get no annualised figure.
    """
    rets = levels[a + 1:b + 1] / levels[a:b] - 1
    n = len(rets)
    total = levels[b] / levels[a] - 1
    path = levels[a:b + 1] / levels[a]
    return {
        "months": n,
        "total_return": total,
        "annualised_return": (1 + total) ** (12 / n) - 1 if n >= MIN_MONTHS_TO_ANNUALISE else np.nan,
        "volatility": float(np.std(rets, ddof=1) * np.sqrt(12)) if n >= 2 else np.nan,
        "max_drawdown": float((path / np.maximum.accumulate(path) - 1).min()),
    }


def nearest_distance(truth: list[int], found: list[int]) -> list[int]:
    return [min(abs(t - f) for f in found) for t in truth] if found else []


# ---------------------------------------------------------------- run
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--levels", type=Path, default=ROOT / "data" / "index_levels.csv")
    ap.add_argument("--truth", type=Path, default=ROOT / "data" / "reference_bear_markets.csv",
                    help="monthly bull/bear labels to measure breakpoints against")
    ap.add_argument("--truth-label", default="Reference bear markets", help="name for the labels on the dashboard")
    ap.add_argument("--out", type=Path, default=ROOT / "output")
    ap.add_argument("--docs", type=Path, default=ROOT / "dashboard")
    ap.add_argument("--level", action="store_true", help="fit growth of $1 instead of its log")
    a = ap.parse_args()

    lv = pd.read_csv(a.levels)
    dates = list(lv["date"])
    assets = [c for c in lv.columns if c != "date"]

    model_rows, seg_rows, summary = [], [], []
    for asset in assets:
        L = lv[asset].to_numpy(float)
        g = L / L[0]
        if a.level:
            breaks, fit, r2 = greedy_piecewise(g, rsq_target=RSQ_TARGET_LEVEL)
        else:
            breaks, fit, r2 = greedy_piecewise(np.log(g))
            fit = np.exp(fit)
        bset = set(breaks)
        for i, d in enumerate(dates):
            model_rows.append({"asset": asset, "date": d, "cumret": g[i], "y_hat": fit[i],
                               "ret": (L[i] / L[i - 1] - 1) if i else np.nan, "is_breakpoint": i in bset})
        for k, (s, e) in enumerate(zip(breaks, breaks[1:]), start=1):
            own = segment_stats(L, s, e)
            for other in assets:
                if other == asset:
                    continue
                comp = segment_stats(lv[other].to_numpy(float), s, e)
                seg_rows.append({"asset": asset, "segment": k, "start_date": dates[s], "end_date": dates[e],
                                 **{f"asset_{x}": v for x, v in own.items() if x != "months"}, "months": own["months"],
                                 "compared_to": other, **{f"comp_{x}": v for x, v in comp.items() if x != "months"},
                                 "excess_total_return": own["total_return"] - comp["total_return"]})
        n_m = len(L) - 1
        summary.append({"asset": asset, "segments": len(breaks) - 1, "r2": r2, "months": n_m,
                        "growth": g[-1], "cagr": g[-1] ** (12 / n_m) - 1})

    model = pd.DataFrame(model_rows)
    segs = pd.DataFrame(seg_rows)
    summ = pd.DataFrame(summary)

    tables = {"model_outputs": model, "segment_comparisons": segs, "summary": summ}
    if a.truth.exists():
        tr = pd.read_csv(a.truth)
        tables["true_regimes"] = tr
        change_idx = [i + 1 for i in range(1, len(tr)) if tr.regime.iloc[i] != tr.regime.iloc[i - 1]]
        acc = []
        for asset in assets:
            found = [i for i, b in enumerate(model[model.asset == asset].is_breakpoint) if b][1:-1]
            dist = nearest_distance(change_idx, found)
            acc.append({"asset": asset, "true_changes": len(change_idx), "breakpoints": len(found),
                        "within_3_months": sum(d <= 3 for d in dist), "median_distance_months": float(np.median(dist))})
        tables["detection"] = pd.DataFrame(acc)
        tables["meta"] = pd.DataFrame([{"truth_label": a.truth_label, "fit": "level" if a.level else "log",
                                         "rsq_target": RSQ_TARGET_LEVEL if a.level else RSQ_TARGET}])

    a.out.mkdir(parents=True, exist_ok=True)
    for t, df in tables.items():
        df.to_csv(a.out / f"{t}.csv", index=False, float_format="%.6f")
    a.docs.mkdir(parents=True, exist_ok=True)
    (a.docs / "data.js").write_text("window.DASH_DATA = " + json.dumps(
        {t: df.to_csv(index=False, float_format="%.6f") for t, df in tables.items()}) + ";\n")

    print(summ.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    if "detection" in tables:
        print(f"\nBreakpoints against {a.truth_label.lower()}")
        print(tables["detection"].to_string(index=False))
    print(f"\nWrote {a.out} and {a.docs / 'data.js'}")


if __name__ == "__main__":
    main()
