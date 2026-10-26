# Allocation Frontier

A Monte Carlo search for strategic asset allocations that maximise the probability of beating a 7.5% return objective, with a stress test of the private equity assumption that drives the answer.

The dashboard is built from a real allocation review: real capital market assumptions, real portfolio weights and 22 years of monthly index returns (Apr 2003 to Mar 2025). Only derived results are published. The raw index returns are licensed data and are not in this repo. Not investment advice.

**Dashboard:** open `docs/index.html` in a browser, or publish `docs/` with GitHub Pages.

## What it does

1. Draws 25,000 random long-only portfolios across seven asset classes (cash capped at 5%).
2. Scores each on expected return, risk, income yield, the probability of beating 7.5% in a year, and how often to expect a negative year.
3. Splits the risk range into 15 bands and keeps the highest probability and the highest income portfolio in each.
4. Compares three named portfolios: the current allocation, a higher income alternative and the maximum probability portfolio.
5. Runs everything twice: with private equity as measured, and with private equity made to move like equities.

## The finding

The private equity proxy has equity-like volatility (12.5%) but almost no correlation with listed equities (−0.04 with global equities). It is not smoothing: lag-1 autocorrelation is about 0.1, and the correlation stays near zero at every lag up to six months and on quarterly returns. An optimiser reads that as a free diversifier, so the maximum probability portfolio puts 50% in private equity.

Rebuilding the proxy to move with global equities at a correlation of 0.7, keeping its return and volatility:

| | Current portfolio | Maximum probability (50% private equity) |
|---|---|---|
| Risk, as measured | 7.98% | 8.14% |
| Risk, equity-like private equity | 8.93% | 10.76% |
| P(return > 7.5%), as measured | 55.6% | 62.6% |
| P(return > 7.5%), equity-like | 55.0% | 59.6% |

The maximum probability portfolio still comes out ahead, but its risk advantage disappears: it moves from about the same risk as the current portfolio to 1.8 points more.

## Method

**Expected return** = Σ weightᵢ × expected returnᵢ.

**Risk** = √(wᵀ Σ w) × √12, where Σ is the covariance matrix of monthly returns.

**Probability of beating the hurdle**, assuming normally distributed annual returns:

```
P = Φ((return − 7.5%) ÷ risk)
```

Example, current portfolio: (8.63% − 7.5%) ÷ 7.98% = 0.14, and Φ(0.14) = 55.6%.

**Negative year, 1 in N** = 1 ÷ Φ(−return ÷ risk). Current portfolio: Φ(−1.08) = 14.0%, about 1 year in 7.

**Equity-like private equity.** Standardise the proxy's returns and global equity returns, remove any link between them, then rebuild:

```
new = mean + volatility × (0.7 × z_global_equities + √(1 − 0.7²) × z_own)
```

The new series has the proxy's mean and volatility and a correlation of exactly 0.7 with global equities.

**Drawdowns** apply each portfolio's weights to the monthly history, rebalanced monthly: drawdown = growth of $1 ÷ running peak − 1.

**Risk bands** cover the full range from lowest to highest simulated risk in 15 equal steps.

## Running it

```
pip install -r requirements.txt
python src/generate_data.py                 # example inputs in data/ (made up, same shape as the real ones)
python src/frontier.py                      # runs on the example inputs
python src/frontier.py --excel inputs.xlsx  # runs on a private workbook with sheets CMA, Data, Portfolio Options
python -m pytest
```

`*.xlsx` is in `.gitignore`, so a private workbook in this folder is never committed.

## What is published

| In `docs/data.js` | Not published |
|---|---|
| Statistics for every simulated portfolio | Monthly index returns |
| Weights and statistics for named and frontier portfolios | |
| Volatility, correlation and average return per asset | |
| Growth paths for the three named portfolios only | |
| Drawdown episodes for every portfolio | |

## Tests

`tests/test_frontier.py` checks the probability formula against the worked example, two-asset portfolio risk against the textbook formula, the weight constraints, and that the equity-like rebuild keeps the mean and volatility and hits the target correlation.

## Limits

- Normal returns. Fat tails would lower the probability for riskier portfolios.
- Random search, not an optimiser: the frontier is the best of 25,000 draws.
- One period. No contributions, withdrawals or rebalancing costs.
- The 0.7 correlation is an assumption. A cap on private equity is the other common fix.
