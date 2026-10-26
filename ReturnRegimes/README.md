# Return Regimes

Splits index histories into market regimes with a piecewise trend, then compares indices regime by regime over exactly the same months.

The dashboard uses actual monthly total return indices for the S&P 500, MSCI World and MSCI Emerging Markets (USD), January 2000 to March 2025. A synthetic dataset with known regimes is included to validate the method.

**Dashboard:** open `dashboard/index.html` in a browser, or publish `dashboard/` with GitHub Pages.

```
pip install -r requirements.txt
python src/regimes.py         # actual data in data/; results in output/, dashboard data in dashboard/data.js
python -m pytest
```

Run it on your own month-end levels (a `date` column and one column per index):

```
python src/regimes.py --levels my_levels.csv
```

## Method

**Trend fit.** Take the log of growth of $1, so a 20% fall counts the same in 2001 as in 2021. Fit one straight line from the first month to the last. Add a breakpoint at the month furthest from the fit, refit straight lines between all breakpoints, and repeat until R² reaches 0.99 or there are 15 segments.

```
R² = 1 − Σ(actual − fit)² ÷ Σ(actual − mean)²
```

**Segment statistics.** A segment covers the months after its start breakpoint up to and including its end breakpoint, so every month belongs to exactly one segment.

| Statistic | Formula |
|---|---|
| Total return | level at end ÷ level at start − 1 |
| Annualised return | (1 + total)^(12 ÷ months) − 1, only for segments of 12 months or more |
| Volatility | standard deviation of monthly returns × √12 |
| Max drawdown | deepest fall from a peak within the segment |
| Excess total return | index total return − comparison total return, same months |

Example: 24 months at 1% a month is a total return of 1.01²⁴ − 1 = 27.0% and an annualised return of 1.01¹² − 1 = 12.7%. The arithmetic shortcut, 1% × 12 = 12.0%, understates it.

## Does it find the bear markets?

The reference points are the S&P 500's month-end peaks and troughs in four bear markets, taken from the data:

| Bear market | Peak | Trough | S&P 500 fall |
|---|---|---|---|
| Dot-com | Aug 2000 | Sep 2002 | −44.7% |
| Global financial crisis | Oct 2007 | Feb 2009 | −50.9% |
| COVID | Jan 2020 | Mar 2020 | −19.6% |
| Inflation and rate rises | Dec 2021 | Sep 2022 | −23.9% |

Distance in months from each date to the nearest fitted breakpoint, S&P 500:

| Fit | Dot-com peak | Dot-com trough | GFC peak / trough | COVID peak / trough | 2022 peak / trough |
|---|---|---|---|---|---|
| Growth of $1 (level) | 86 | 61 | 0 / 0 | 1 / 0 | 0 / 0 |
| Log growth (default) | 19 | 0 | 0 / 0 | 0 / 0 | 0 / 0 |

The level fit misses the dot-com bear market completely: the index was below $1.30 then, so its falls are small in dollars next to the $6 levels of later years. The log fit catches it. The dot-com peak is 7 months after the series starts, so the fit uses the start of the data as that boundary.

Across all three indices, the log fit lands within 3 months of 17 of the 24 reference dates, the level fit 16. Run `python src/regimes.py --level` to compare.

### Validation on synthetic data

`data/synthetic/` holds 25 years of made-up index levels from a two-state (bull/bear) model, where the true regime changes are known. `python src/generate_data.py` rebuilds it.

```
python src/regimes.py --levels data/synthetic/index_levels.csv \
    --truth data/synthetic/true_regimes.csv --truth-label "True bear markets"
```

Here the log fit finds 21 of 30 true regime changes within 3 months and the level fit 23. The misses are the start or end of short bear markets of 8 to 9 months. Neither fit wins everywhere; the log fit is the default because it does not let the most recent decade dominate.

## Changes from the original notebook

The original version of this analysis:

- annualised long segments as mean monthly return × 12, and reported short segments as un-annualised totals in the same column
- counted each breakpoint month in both segments it joined
- fitted the trend to growth of $1, which missed the dot-com bear market

This version reports total and compound annualised returns separately, leaves annualised blank under 12 months, uses each month once, and fits log growth. The tests check the first three.

## Files

| File | Contents |
|---|---|
| `data/index_levels.csv` | actual month-end total return index levels, base 100 in Jan 2000 |
| `data/reference_events.csv` | the four reference bear markets |
| `data/reference_bear_markets.csv` | the same as monthly bull/bear labels |
| `data/synthetic/` | synthetic levels and true regimes for validation |
| `output/segment_comparisons.csv` | one row per segment and comparison index |
| `output/detection.csv` | breakpoint distances to the reference dates |
