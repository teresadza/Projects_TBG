"""Generate synthetic equity index levels with known market regimes.

A shared two-state Markov chain (bull or bear) drives three made-up indices.
Each index has its own sensitivity to the regime plus its own noise. Because
the true regimes are known, the project can measure how well the trend
segmentation finds them, which is not possible with real index data.

  data/synthetic/index_levels.csv   month-end levels, one column per index, base 100
  data/synthetic/true_regimes.csv   month-end date and the true regime (bull or bear)

Usage:  python src/generate_data.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

SEED = 350
OUT = Path(__file__).resolve().parents[1] / "data" / "synthetic"
MONTHS = 300                       # Feb 2000 to Jan 2025

# monthly probability of staying in the current regime
STAY = {"bull": 0.975, "bear": 0.88}
# regime driver: monthly mean and volatility
DRIVER = {"bull": (0.013, 0.030), "bear": (-0.020, 0.050)}
# index: (beta to driver, own monthly volatility, own drift)
INDICES = {
    "Developed markets": (1.00, 0.010, 0.0000),
    "US large caps": (1.05, 0.012, 0.0006),
    "Emerging markets": (1.35, 0.025, -0.0004),
}


def main() -> None:
    rng = np.random.default_rng(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    state, states = "bull", []
    for _ in range(MONTHS):
        if rng.random() > STAY[state]:
            state = "bear" if state == "bull" else "bull"
        states.append(state)
    driver = np.array([rng.normal(*DRIVER[s]) for s in states])

    dates = pd.date_range("2000-01-31", periods=MONTHS + 1, freq="ME")
    levels = {"date": dates.strftime("%Y-%m-%d")}
    for name, (beta, vol, drift) in INDICES.items():
        r = beta * driver + drift + rng.normal(0, vol, MONTHS)
        levels[name] = np.round(100 * np.concatenate([[1.0], np.cumprod(1 + r)]), 4)
    pd.DataFrame(levels).to_csv(OUT / "index_levels.csv", index=False)
    pd.DataFrame({"date": dates[1:].strftime("%Y-%m-%d"), "regime": states}).to_csv(OUT / "true_regimes.csv", index=False)

    changes = sum(a != b for a, b in zip(states, states[1:]))
    print(f"Wrote {OUT}: {MONTHS} months, {changes} regime changes, "
          f"{states.count('bear')} bear months")


if __name__ == "__main__":
    main()
