"""Known-answer tests for the climate metrics.

A tiny fund holds two companies. The expected answers are worked by hand in
the README:

    Company A: $10m holding, EVIC $1,000m, revenue $800m, Scope 1+2 500,000 t
    Company B:  $5m holding, EVIC   $250m, revenue $100m, Scope 1+2  40,000 t

    financed emissions = 10/1000 x 500,000 + 5/250 x 40,000 = 5,000 + 800 = 5,800 t
    carbon footprint   = 5,800 / 15 = 386.7 t per $m invested
    WACI               = (10/15) x 625 + (5/15) x 400 = 550 t per $m revenue
"""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pipeline import run  # noqa: E402

REPORT = "2025-03-31"
FY = "2024-12-31"


def write(folder: Path, name: str, rows: list[dict]) -> None:
    with open(folder / name, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def build(tmp_path: Path, emissions: list[dict], holdings_extra: list[dict] | None = None,
          financials_extra: list[dict] | None = None):
    raw = tmp_path / "raw"
    raw.mkdir()
    write(raw, "funds.csv", [{"fund_id": "T", "fund_name": "Test Fund"}])
    write(raw, "companies.csv", [
        {"company_id": "A", "company_name": "Company A", "sector": "Utilities", "country": "NZ", "high_risk_sector": "True"},
        {"company_id": "B", "company_name": "Company B", "sector": "Materials", "country": "NZ", "high_risk_sector": "False"},
    ])
    write(raw, "company_financials.csv", [
        {"company_id": "A", "fy_end": FY, "revenue_nzd_m": 800, "evic_nzd_m": 1000},
        {"company_id": "B", "fy_end": FY, "revenue_nzd_m": 100, "evic_nzd_m": 250},
    ] + (financials_extra or []))
    write(raw, "emissions_vendor.csv", emissions)
    write(raw, "instruments.csv", [
        {"instrument_id": "A-EQ", "company_id": "A", "asset_class": "Listed equity", "description": "A shares"},
        {"instrument_id": "B-EQ", "company_id": "B", "asset_class": "Listed equity", "description": "B shares"},
        {"instrument_id": "CASH", "company_id": "", "asset_class": "Cash", "description": "Cash"},
    ])
    write(raw, "holdings.csv", [
        {"fund_id": "T", "report_date": REPORT, "instrument_id": "A-EQ", "market_value_nzd": 10_000_000, "face_value_nzd": ""},
        {"fund_id": "T", "report_date": REPORT, "instrument_id": "B-EQ", "market_value_nzd": 5_000_000, "face_value_nzd": ""},
        {"fund_id": "T", "report_date": REPORT, "instrument_id": "CASH", "market_value_nzd": 1_000_000, "face_value_nzd": ""},
    ] + (holdings_extra or []))
    return run(raw, tmp_path / "test.duckdb", quiet=True)


def emis(cid, fy, s1, s2, load="2025-06-30"):
    return {"company_id": cid, "fy_end": fy, "scope1_t": s1, "scope2_t": s2, "scope3_t": "", "vendor_load_date": load}


BASE = [emis("A", FY, 400_000, 100_000), emis("B", FY, 30_000, 10_000)]


def metric(con, col, scope="Scope 1+2"):
    return con.execute(f"""SELECT {col} FROM fact.portfolio_metrics
                           WHERE scope = ? AND asset_class = 'All corporate'""", [scope]).fetchone()[0]


def test_worked_example(tmp_path):
    con = build(tmp_path, BASE)
    assert metric(con, "financed_emissions_t") == pytest.approx(5_800)
    assert metric(con, "carbon_footprint_t_per_m") == pytest.approx(5_800 / 15)        # 386.7
    assert metric(con, "waci_t_per_revenue_m") == pytest.approx(10 / 15 * 625 + 5 / 15 * 400)  # 550
    assert metric(con, "coverage") == pytest.approx(1.0)


def test_cash_is_excluded_from_metrics_but_in_fund_value(tmp_path):
    con = build(tmp_path, BASE)
    assert metric(con, "fund_value_nzd") == pytest.approx(16_000_000)
    assert metric(con, "corporate_value_nzd") == pytest.approx(15_000_000)


def test_scopes_add_up(tmp_path):
    con = build(tmp_path, BASE)
    s1, s2 = metric(con, "financed_emissions_t", "Scope 1"), metric(con, "financed_emissions_t", "Scope 2")
    assert s1 + s2 == pytest.approx(metric(con, "financed_emissions_t", "Scope 1+2"))
    assert s1 == pytest.approx(10 / 1000 * 400_000 + 5 / 250 * 30_000)                # 4,600


def test_prior_year_fallback_is_used_and_flagged(tmp_path):
    # B has not reported FY2024 yet, so its FY2023 figures and FY2023 EVIC are used
    emissions = [emis("A", FY, 400_000, 100_000), emis("B", "2023-12-31", 30_000, 10_000, "2024-06-30")]
    extra = [{"company_id": "B", "fy_end": "2023-12-31", "revenue_nzd_m": 100, "evic_nzd_m": 200}]
    con = build(tmp_path, emissions, financials_extra=extra)
    assert metric(con, "financed_emissions_t") == pytest.approx(5_000 + 5 / 200 * 40_000)  # 6,000
    assert metric(con, "fallback_share") == pytest.approx(5 / 15)
    flagged = con.execute("SELECT instrument_id FROM fact.holding WHERE is_fallback AND scope = 'Scope 1+2'").fetchall()
    assert flagged == [("B-EQ",)]


def test_restatement_uses_latest_delivery(tmp_path):
    emissions = BASE + [emis("B", FY, 60_000, 20_000, "2025-11-30")]   # B restated: 80,000 t
    con = build(tmp_path, emissions)
    assert metric(con, "financed_emissions_t") == pytest.approx(5_000 + 5 / 250 * 80_000)  # 6,600


def test_missing_emissions_reduce_coverage(tmp_path):
    con = build(tmp_path, [emis("A", FY, 400_000, 100_000)])
    assert metric(con, "coverage") == pytest.approx(10 / 15)
    assert metric(con, "carbon_footprint_t_per_m") == pytest.approx(5_000 / 10)


def test_bad_holding_stops_the_pipeline(tmp_path):
    with pytest.raises(RuntimeError, match="Q01"):
        build(tmp_path, BASE, holdings_extra=[
            {"fund_id": "T", "report_date": REPORT, "instrument_id": "UNKNOWN", "market_value_nzd": 1, "face_value_nzd": ""}])
