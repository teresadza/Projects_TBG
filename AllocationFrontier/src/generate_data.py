"""Generate illustrative inputs for the allocation frontier.

Everything here is made up for demonstration:

  data/assumptions.csv        expected return and income yield per asset class
                              (illustrative capital market assumptions, not a forecast)
  data/monthly_returns.csv    20 years of synthetic monthly returns, used for
                              volatility, correlation and drawdowns
  data/reference_portfolio.csv  a typical balanced portfolio to compare against

Private equity is generated as a proxy with equity-like volatility but almost
no correlation with listed equities, the pattern that makes an optimiser treat
it as a free diversifier. The frontier's equity_like scenario stress-tests that.

Usage:  python src/generate_data.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

SEED = 74
OUT = Path(__file__).resolve().parents[1] / "data"
MONTHS = 240

# asset key: (label, role, expected annual return, income yield, annual volatility)
ASSETS = {
    "cash":             ("Cash", "income", 0.040, 0.040, 0.006),
    "nz_bonds":         ("NZ bonds", "income", 0.048, 0.045, 0.045),
    "global_bonds":     ("Global bonds (hedged)", "income", 0.049, 0.038, 0.038),
    "aus_nz_equities":  ("Australasian equities", "growth", 0.082, 0.035, 0.140),
    "global_equities":  ("Global equities", "growth", 0.086, 0.018, 0.135),
    "listed_property":  ("Listed property", "income", 0.074, 0.048, 0.150),
    "private_equity":   ("Private equity", "growth", 0.105, 0.005, 0.125),
}
KEYS = list(ASSETS)

# Correlations of the true (unsmoothed) monthly returns
CORR = np.array([
    #  cash  nzb   glb   ause  gle   prop  pe
    [1.00, 0.20, 0.15, 0.00, 0.00, 0.00, 0.00],
    [0.20, 1.00, 0.70, 0.10, 0.05, 0.25, 0.00],
    [0.15, 0.70, 1.00, 0.05, 0.05, 0.20, 0.00],
    [0.00, 0.10, 0.05, 1.00, 0.70, 0.65, 0.00],
    [0.00, 0.05, 0.05, 0.70, 1.00, 0.60, 0.00],
    [0.00, 0.25, 0.20, 0.65, 0.60, 1.00, 0.00],
    [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1.00],
])

REFERENCE = {"cash": 0.05, "nz_bonds": 0.15, "global_bonds": 0.20, "aus_nz_equities": 0.15,
             "global_equities": 0.30, "listed_property": 0.05, "private_equity": 0.10}


def main() -> None:
    rng = np.random.default_rng(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    mu_m = np.array([ASSETS[k][2] for k in KEYS]) / 12
    vol_m = np.array([ASSETS[k][4] for k in KEYS]) / np.sqrt(12)
    cov = np.outer(vol_m, vol_m) * CORR
    true = rng.multivariate_normal(mu_m, cov, size=MONTHS)

    # two market shocks so the drawdowns have something to show
    for start, depth in [(45, -0.045), (180, -0.03)]:
        for j, k in enumerate(KEYS):
            beta = {"aus_nz_equities": 1.0, "global_equities": 1.0, "listed_property": 1.1}.get(k, 0.0)
            true[start:start + 4, j] += depth * beta

    reported = true

    dates = pd.date_range("2005-04-30", periods=MONTHS, freq="ME")
    df = pd.DataFrame(reported, columns=KEYS)
    df.insert(0, "date", dates.strftime("%Y-%m-%d"))
    df.to_csv(OUT / "monthly_returns.csv", index=False, float_format="%.6f")

    pd.DataFrame([{"asset": k, "label": v[0], "role": v[1], "expected_return": v[2], "income_yield": v[3]}
                  for k, v in ASSETS.items()]).to_csv(OUT / "assumptions.csv", index=False)
    pd.DataFrame([{"asset": k, "weight": w} for k, w in REFERENCE.items()]).to_csv(
        OUT / "reference_portfolio.csv", index=False)

    r = pd.DataFrame(reported, columns=KEYS)
    print(f"Wrote {OUT}")
    print(f"  private equity reported vol {r['private_equity'].std() * np.sqrt(12):.1%}, "
          f"corr with global equities {r['private_equity'].corr(r['global_equities']):.2f}")


if __name__ == "__main__":
    main()
