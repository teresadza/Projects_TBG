"""Monte Carlo allocation frontier with a probability-of-hurdle objective.

Generates random long-only portfolios, scores each one, and keeps the best
portfolio in each risk band. Runs two scenarios:

  as_reported   private equity risk taken from its return history as it is
  equity_like   private equity keeps its own return and volatility, but moves
                with global equities at a correlation of 0.7

Usage:
  python src/frontier.py                       # example inputs in data/
  python src/frontier.py --excel inputs.xlsx   # private workbook (sheets: CMA, Data, Portfolio Options)

Only derived results are written to docs/data.js: portfolio statistics,
summary statistics per asset, drawdown episodes, and growth paths for the
named portfolios. Raw index returns are not published.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[1]
HURDLE = 0.075          # annual return objective
N_PORTFOLIOS = 25_000   # per scenario
CAP = {"cash": 0.05}    # maximum weight per asset
N_BANDS = 15
SEED = 42
PE_KEY, ANCHOR_KEY, STRESS_CORR = "private_equity", "global_equities", 0.7

# Workbook column names -> asset keys and labels
EXCEL_ASSETS = {
    "Bloomberg_Global_Aggregate_TR_Hdg_NZD": ("global_bonds", "Global bonds (hedged)"),
    "Cash": ("cash", "Cash"),
    "Cat_50__S_P_NZX_50__50__S_P_ASX_200": ("aus_nz_equities", "Australasian equities"),
    "MSCI_ACWI_Ex_Australia_NR_LCL": ("global_equities", "Global equities"),
    "Private Equity Proxy": ("private_equity", "Private equity"),
    "Property  Proxy": ("listed_property", "Property"),
    "S_P_NZX_NZ_Corporate_Bond_A_Grade_NZD": ("nz_bonds", "NZ corporate bonds"),
}
NAMED = {"current": "Current portfolio", "hi_income": "Highest income / return", "max_prob_prev": "Maximum probability"}


# ---------------------------------------------------------------- statistics
def portfolio_stats(w, mu, cov_m, yld, growth) -> dict:
    """Expected return, risk, income, probability of beating the hurdle and of a negative year."""
    ret = float(w @ mu)
    risk = float(np.sqrt(w @ cov_m @ w) * np.sqrt(12))
    return {"ret": ret, "risk": risk, "income": float(w @ yld),
            "prob": float(norm.cdf((ret - HURDLE) / risk)),
            "p_neg": float(norm.cdf(-ret / risk)),
            "growth": float(w[growth].sum())}


def equity_like(target: pd.Series, anchor: pd.Series, rho: float) -> pd.Series:
    """Rebuild a return series with the same mean and volatility but correlation rho with anchor.

    new = mean + vol × (rho × z_anchor + √(1 − rho²) × z_resid), where z_resid is the target's
    own standardised variation with any link to the anchor removed.
    """
    za = (anchor - anchor.mean()) / anchor.std()
    zt = (target - target.mean()) / target.std()
    resid = zt - zt.cov(za) * za
    resid = resid / resid.std()
    return target.mean() + target.std() * (rho * za + np.sqrt(1 - rho ** 2) * resid)


def random_weights(rng, n: int, k: int, caps: dict[int, float]) -> np.ndarray:
    """Uniform random weights summing to 1; capped assets are set to their cap and the rest rescaled."""
    w = rng.random((n, k))
    w /= w.sum(1, keepdims=True)
    for j, cap in caps.items():
        over = w[:, j] > cap
        others = [i for i in range(k) if i != j]
        sub = w[over]
        sub[:, others] = sub[:, others] / sub[:, others].sum(1, keepdims=True) * (1 - cap)
        sub[:, j] = cap
        w[over] = sub
    return w


def drawdown_episodes(dates, dd: np.ndarray, top: int = 3) -> list[dict]:
    eps, i, n = [], 0, len(dd)
    while i < n:
        if dd[i] < 0:
            s, j = i - 1, i
            while j < n and dd[j] < 0:
                j += 1
            v = i + int(np.argmin(dd[i:j]))
            eps.append({"start": dates[max(s, 0)], "valley": dates[v], "recovered": dates[j] if j < n else "",
                        "depth": float(dd[v]), "months_to_valley": v - s,
                        "months_to_recover": (j - s) if j < n else None})
            i = j
        else:
            i += 1
    return sorted(eps, key=lambda e: e["depth"])[:top]


# ---------------------------------------------------------------- inputs
def load_csv_inputs(folder: Path):
    assumptions = pd.read_csv(folder / "assumptions.csv")
    returns = pd.read_csv(folder / "monthly_returns.csv")
    named = {"current": dict(pd.read_csv(folder / "reference_portfolio.csv").values)}
    return assumptions, returns, named


def load_excel_inputs(path: Path):
    x = pd.ExcelFile(path)
    cma = x.parse("CMA")
    data = x.parse("Data").sort_values("Date")
    assumptions = pd.DataFrame([{
        "asset": EXCEL_ASSETS[r["Asset"]][0], "label": EXCEL_ASSETS[r["Asset"]][1], "role": r["Classification"],
        "expected_return": r["AnnRet"], "income_yield": r["Yield"]} for _, r in cma.iterrows()])
    returns = data.rename(columns={k: v[0] for k, v in EXCEL_ASSETS.items()})
    returns["date"] = pd.to_datetime(returns.pop("Date")).dt.strftime("%Y-%m-%d")
    po = x.parse("Portfolio Options", header=None)
    named = {}
    for col, pid in zip([3, 4, 5], NAMED):
        named[pid] = {EXCEL_ASSETS[a][0]: float(po.loc[po[0] == a, col].iloc[0]) for a in EXCEL_ASSETS}
    return assumptions, returns, named


# ---------------------------------------------------------------- scenario
def run_scenario(name, returns, assumptions, named, rng) -> dict:
    keys = list(assumptions["asset"])
    R = returns[keys].astype(float).copy()
    if name == "equity_like":
        R[PE_KEY] = equity_like(R[PE_KEY], R[ANCHOR_KEY], STRESS_CORR)
    mu = assumptions["expected_return"].to_numpy(float)
    yld = assumptions["income_yield"].to_numpy(float)
    growth = (assumptions["role"] == "growth").to_numpy()
    cov_m = np.cov(R.to_numpy().T)
    caps = {keys.index(a): c for a, c in CAP.items()}

    W = random_weights(rng, N_PORTFOLIOS, len(keys), caps)
    ret = W @ mu
    risk = np.sqrt(np.einsum("ij,jk,ik->i", W, cov_m, W)) * np.sqrt(12)
    prob = norm.cdf((ret - HURDLE) / risk)
    inc = W @ yld
    edges = np.linspace(risk.min(), risk.max(), N_BANDS + 1)
    band = np.clip(np.searchsorted(edges, risk, side="right") - 1, 0, N_BANDS - 1)

    ports = []

    def add(pid, group, label, w, b=None):
        row = {"scenario": name, "id": pid, "group": group, "label": label, "bucket": b,
               "bucket_low": None if b is None else edges[b], "bucket_high": None if b is None else edges[b + 1]}
        row.update({f"w_{k}": float(w[i]) for i, k in enumerate(keys)})
        row.update(portfolio_stats(w, mu, cov_m, yld, growth))
        ports.append(row)

    for pid, weights in named.items():
        add(pid, "named", NAMED[pid], np.array([weights[k] for k in keys]))
    if "hi_income" not in named:        # example inputs: derive the other two named portfolios
        ref = ports[0]
        ok = np.where((ret >= ref["ret"]) & (risk <= ref["risk"]))[0]
        if len(ok):
            add("hi_income", "named", NAMED["hi_income"], W[ok[np.argmax(inc[ok])]])
        add("max_prob_prev", "named", NAMED["max_prob_prev"], W[int(np.argmax(prob))])
    for b in range(N_BANDS):
        idx = np.where(band == b)[0]
        if len(idx) == 0:
            continue
        add(f"mp{b + 1:02d}", "max_prob", f"Max probability, risk band {b + 1}", W[idx[np.argmax(prob[idx])]], b)
        add(f"mi{b + 1:02d}", "max_income", f"Max income, risk band {b + 1}", W[idx[np.argmax(inc[idx])]], b)

    sim = pd.DataFrame({"scenario": name, "risk": risk, "ret": ret, "prob": prob, "income": inc,
                        "growth": W[:, growth].sum(1)})
    corr = R.corr()
    assets = assumptions.assign(
        scenario=name, weight_key=["w_" + k for k in keys], cma_return=mu,
        hist_return=(R.mean() * 12).to_numpy(), hist_vol=(R.std() * np.sqrt(12)).to_numpy(),
        corr_aus_eq=corr["aus_nz_equities"].to_numpy(), corr_global_eq=corr["global_equities"].to_numpy())

    dates = list(returns["date"])
    hist, dds = [], []
    for p in ports:
        w = np.array([p[f"w_{k}"] for k in keys])
        g = np.cumprod(1 + R.to_numpy() @ w)
        dd = g / np.maximum.accumulate(g) - 1
        if p["group"] == "named":       # growth paths only for the three named portfolios
            hist += [{"scenario": name, "id": p["id"], "date": d, "growth": gv, "drawdown": dv}
                     for d, gv, dv in zip(dates, g, dd)]
        for r_, e in enumerate(drawdown_episodes(dates, dd)):
            dds.append({"scenario": name, "id": p["id"], "rank": r_ + 1, **e})

    return {"portfolios": pd.DataFrame(ports), "simulated": sim, "assets": assets,
            "history": pd.DataFrame(hist), "drawdowns": pd.DataFrame(dds),
            "meta": pd.DataFrame([{"scenario": name, "start": dates[0], "end": dates[-1], "months": len(dates),
                                   "pe_corr_global_eq": float(corr.loc[PE_KEY, ANCHOR_KEY])}])}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=ROOT / "data", help="folder with example CSV inputs")
    ap.add_argument("--excel", type=Path, help="private workbook to use instead of the example inputs")
    ap.add_argument("--out", type=Path, default=ROOT / "output")
    ap.add_argument("--docs", type=Path, default=ROOT / "docs")
    a = ap.parse_args()

    assumptions, returns, named = load_excel_inputs(a.excel) if a.excel else load_csv_inputs(a.data)
    for pid, w in named.items():
        assert abs(sum(w.values()) - 1) < 1e-6, f"{pid} weights must sum to 1"

    results = {s: run_scenario(s, returns, assumptions, named, np.random.default_rng(SEED))
               for s in ["as_reported", "equity_like"]}

    a.out.mkdir(parents=True, exist_ok=True)
    a.docs.mkdir(parents=True, exist_ok=True)
    tables = {}
    for t in ["portfolios", "simulated", "assets", "history", "drawdowns", "meta"]:
        tables[t] = pd.concat([results[s][t] for s in results], ignore_index=True)
        tables[t].to_csv(a.out / f"{t}.csv", index=False, float_format="%.6f")
    payload = {t: df.to_csv(index=False, float_format="%.4f" if t == "simulated" else "%.6f") for t, df in tables.items()}
    (a.docs / "data.js").write_text("window.DASH_DATA = " + json.dumps(payload) + ";\n")

    for s, r in results.items():
        p = r["portfolios"].set_index("id")
        m = r["meta"].iloc[0]
        print(f"\n{s}  (private equity correlation with global equities {m['pe_corr_global_eq']:.2f})")
        for pid in NAMED:
            if pid in p.index:
                x = p.loc[pid]
                print(f"  {x['label']:<26} return {x['ret']:.2%}  risk {x['risk']:.2%}  income {x['income']:.2%}  "
                      f"P(>{HURDLE:.1%}) {x['prob']:.1%}  private equity {x['w_private_equity']:.0%}")
        best = r["portfolios"].loc[r["portfolios"]["prob"].idxmax()]
        print(f"  best of all: {best['label']}  P {best['prob']:.1%}  risk {best['risk']:.2%}  private equity {best['w_private_equity']:.0%}")
    print(f"\nWrote {a.out} and {a.docs / 'data.js'}")


if __name__ == "__main__":
    main()
