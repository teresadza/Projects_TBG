"""Known-answer tests for the regime segmentation and segment statistics."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from regimes import greedy_piecewise, segment_stats  # noqa: E402


def test_finds_a_single_kink():
    # straight up for 40 months, straight down for 20: one breakpoint at month 40
    y = np.concatenate([np.linspace(1, 2, 41), np.linspace(2, 1.5, 21)[1:]])
    breaks, fit, r2 = greedy_piecewise(y, rsq_target=0.999)
    assert breaks == [0, 40, 60]
    assert r2 == pytest.approx(1.0)
    assert np.allclose(fit, y)


def test_segment_months_are_not_double_counted():
    levels = np.array([100, 110, 121, 108.9, 98.01])
    a = segment_stats(levels, 0, 2)
    b = segment_stats(levels, 2, 4)
    assert a["months"] + b["months"] == len(levels) - 1          # 4 monthly returns, each used once
    assert a["total_return"] == pytest.approx(0.21)              # 121 / 100 - 1
    assert b["total_return"] == pytest.approx(98.01 / 121 - 1)   # -19.0%


def test_annualised_only_from_twelve_months():
    short = segment_stats(100 * 1.01 ** np.arange(7), 0, 6)       # 6 months
    assert np.isnan(short["annualised_return"])
    long = segment_stats(100 * 1.01 ** np.arange(25), 0, 24)      # 24 months at 1% a month
    assert long["annualised_return"] == pytest.approx(1.01 ** 12 - 1)   # 12.7% compound, not 12%
    assert long["total_return"] == pytest.approx(1.01 ** 24 - 1)


def test_max_drawdown():
    levels = np.array([100, 120, 90, 110, 130])
    s = segment_stats(levels, 0, 4)
    assert s["max_drawdown"] == pytest.approx(90 / 120 - 1)      # -25%
