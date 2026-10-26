"""Known-answer tests for the allocation frontier calculations."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from scipy.stats import norm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from frontier import HURDLE, equity_like, portfolio_stats, random_weights  # noqa: E402


def test_probability_of_beating_hurdle():
    # one asset, 8.63% expected return, 7.98% annual volatility
    vol_m = 0.0798 / np.sqrt(12)
    s = portfolio_stats(np.array([1.0]), np.array([0.0863]), np.array([[vol_m ** 2]]),
                        np.array([0.05]), np.array([False]))
    assert s["risk"] == pytest.approx(0.0798)
    z = (0.0863 - HURDLE) / 0.0798                      # 0.14
    assert s["prob"] == pytest.approx(norm.cdf(z))       # 55.6%
    assert s["prob"] == pytest.approx(0.556, abs=0.001)
    assert s["p_neg"] == pytest.approx(norm.cdf(-0.0863 / 0.0798))   # 14.0%, about 1 year in 7


def test_two_asset_risk():
    # 50/50 of two assets, 10% and 20% annual vol, correlation 0.5
    v1, v2 = 0.10 / np.sqrt(12), 0.20 / np.sqrt(12)
    cov = np.array([[v1 * v1, 0.5 * v1 * v2], [0.5 * v1 * v2, v2 * v2]])
    s = portfolio_stats(np.array([0.5, 0.5]), np.array([0.05, 0.09]), cov, np.zeros(2), np.array([False, True]))
    expected = np.sqrt(0.25 * 0.01 + 0.25 * 0.04 + 2 * 0.25 * 0.5 * 0.10 * 0.20)   # 13.2%
    assert s["risk"] == pytest.approx(expected)
    assert s["ret"] == pytest.approx(0.07)
    assert s["growth"] == pytest.approx(0.5)


def test_weights_sum_to_one_and_respect_cap():
    w = random_weights(np.random.default_rng(0), 5000, 7, {0: 0.05})
    assert np.allclose(w.sum(1), 1)
    assert (w >= 0).all()
    assert w[:, 0].max() <= 0.05 + 1e-12


def test_equity_like_keeps_mean_and_volatility_and_sets_correlation():
    rng = np.random.default_rng(1)
    anchor = pd.Series(rng.normal(0.008, 0.04, 264))
    proxy = pd.Series(rng.normal(0.009, 0.036, 264))          # unrelated to the anchor
    new = equity_like(proxy, anchor, 0.7)
    assert new.mean() == pytest.approx(proxy.mean())
    assert new.std() == pytest.approx(proxy.std())
    assert new.corr(anchor) == pytest.approx(0.7, abs=1e-9)
