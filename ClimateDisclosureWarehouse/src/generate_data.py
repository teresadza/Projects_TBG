"""Generate synthetic input files for the climate disclosure warehouse.

Everything here is made up. Company names, financials, emissions and fund
holdings are random draws from a fixed seed, shaped to look like the files a
fund would receive from a holdings system and an ESG data vendor.

The data deliberately includes the problems a real pipeline has to handle:
  * companies with no emissions data at all (coverage gaps)
  * companies whose latest financial year has not been reported yet
    (the pipeline falls back to the prior year and flags it)
  * vendor restatements: the same company and year delivered twice, with the
    later load taking precedence
  * a third of reporting companies never disclose Scope 3
  * sovereign bonds and cash, which are excluded from corporate metrics

Usage:  python src/generate_data.py            (writes to data/raw)
"""
from __future__ import annotations

import csv
import random
from datetime import date
from pathlib import Path

SEED = 20250331
OUT = Path(__file__).resolve().parents[1] / "data" / "raw"

# Sector: (share of companies, scope 1 intensity t/$m revenue, scope 2, scope 3, EV/revenue, high risk)
SECTORS = {
    "Utilities":              (0.07, 1400, 60, 900, 3.5, True),
    "Energy":                 (0.06, 650, 40, 4500, 1.6, True),
    "Materials":              (0.09, 750, 120, 1300, 1.8, True),
    "Industrials":            (0.15, 90, 30, 500, 1.9, False),
    "Consumer Staples":       (0.09, 45, 25, 700, 1.7, False),
    "Consumer Discretionary": (0.11, 25, 18, 400, 1.6, False),
    "Health Care":            (0.10, 12, 10, 150, 3.2, False),
    "Financials":             (0.12, 2, 3, 40, 2.5, False),
    "Information Technology": (0.11, 6, 12, 120, 5.0, False),
    "Real Estate":            (0.06, 20, 45, 90, 9.0, False),
    "Communication Services": (0.04, 5, 12, 80, 3.0, False),
}
COUNTRIES = ["NZ", "NZ", "AU", "AU", "US", "US", "US", "GB", "JP", "DE", "FR", "CA"]
PREFIX = ["Harbour", "Kauri", "Southern", "Tasman", "Summit", "Pacific", "Ridge", "Cascade", "Meridian",
          "Northgate", "Totara", "Albany", "Coastal", "Granite", "Silverfern", "Orbit", "Riverstone",
          "Kestrel", "Beacon", "Highland", "Westwind", "Aurora", "Clearwater", "Ironbark", "Lakeside"]
SUFFIX = {"Utilities": ["Power", "Energy Networks", "Generation"], "Energy": ["Energy", "Petroleum", "Fuels"],
          "Materials": ["Resources", "Minerals", "Cement"], "Industrials": ["Industries", "Engineering", "Logistics", "Machinery"],
          "Consumer Staples": ["Foods", "Dairy", "Beverages"], "Consumer Discretionary": ["Retail", "Brands", "Motors"],
          "Health Care": ["Health", "Medical", "Biotech"], "Financials": ["Financial", "Capital", "Insurance"],
          "Information Technology": ["Systems", "Software", "Digital"], "Real Estate": ["Property", "Estates", "REIT"],
          "Communication Services": ["Media", "Telecom", "Networks"]}

FY_YEARS = [2019, 2020, 2021, 2022, 2023, 2024]           # financial years ending 31 Dec
REPORT_DATES = [date(y, 3, 31) for y in range(2021, 2026)]  # annual disclosure dates
N_COMPANIES = 160

FUNDS = {
    # fund_id: (name, equity share, AUM $m at first report date, annual growth, decarbonisation tilt per year)
    "GRW": ("Growth Fund", 0.80, 900, 0.08, 0.10),
    "BAL": ("Balanced Fund", 0.55, 1200, 0.06, 0.06),
    "CON": ("Conservative Fund", 0.25, 500, 0.04, 0.03),
}


def write(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / name, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"  {name:<28} {len(rows):>6} rows")


def main() -> None:
    rng = random.Random(SEED)

    # ---------------- companies ----------------
    sectors = list(SECTORS)
    weights = [SECTORS[s][0] for s in sectors]
    companies, used = [], set()
    for i in range(1, N_COMPANIES + 1):
        sector = rng.choices(sectors, weights)[0]
        name = f"{rng.choice(PREFIX)} {rng.choice(SUFFIX[sector])}"
        while name in used:   # draw again until the name is unique
            name = f"{rng.choice(PREFIX)} {rng.choice(SUFFIX[sector])}"
        used.add(name)
        companies.append({
            "company_id": f"C{i:04d}",
            "company_name": name + (" Ltd" if rng.random() < 0.6 else " Group"),
            "sector": sector,
            "country": rng.choice(COUNTRIES),
            "high_risk_sector": SECTORS[sector][5],
        })
    write("companies.csv", companies)

    # ---------------- financials and emissions ----------------
    no_data = set(rng.sample([c["company_id"] for c in companies], int(N_COMPANIES * 0.12)))
    with_data = [c for c in companies if c["company_id"] not in no_data]
    late_reporters = set(rng.sample([c["company_id"] for c in with_data], int(N_COMPANIES * 0.10)))
    restated = set(rng.sample([c["company_id"] for c in with_data], int(N_COMPANIES * 0.08)))
    no_scope3 = set(rng.sample([c["company_id"] for c in with_data], int(len(with_data) * 0.35)))

    financials, emissions = [], []
    for c in companies:
        cid, sector = c["company_id"], c["sector"]
        _, s1i, s2i, s3i, ev_mult, _ = SECTORS[sector]
        revenue = rng.lognormvariate(6.3, 1.0)                 # $m, median about 545
        firm_factor = rng.lognormvariate(0, 0.45)              # company specific intensity
        trend = rng.uniform(-0.09, 0.01)                       # annual change in intensity
        for fy in FY_YEARS:
            revenue *= 1 + rng.gauss(0.05, 0.08)
            evic = revenue * ev_mult * rng.lognormvariate(0, 0.25)
            financials.append({"company_id": cid, "fy_end": f"{fy}-12-31",
                               "revenue_nzd_m": round(revenue, 2), "evic_nzd_m": round(evic, 2)})
            if cid in no_data:
                continue
            if cid in late_reporters and fy == FY_YEARS[-1]:
                continue
            k = firm_factor * (1 + trend) ** (fy - FY_YEARS[0])
            s1 = revenue * s1i * k * rng.lognormvariate(0, 0.08)
            s2 = revenue * s2i * k * rng.lognormvariate(0, 0.10)
            s3 = revenue * s3i * k * rng.lognormvariate(0, 0.15)
            load = date(fy + 1, 6, 30)
            emissions.append({"company_id": cid, "fy_end": f"{fy}-12-31", "scope1_t": round(s1),
                              "scope2_t": round(s2), "scope3_t": round(s3) if cid not in no_scope3 and rng.random() > 0.1 else "",
                              "vendor_load_date": load.isoformat()})
            if cid in restated and fy in (2022, 2023):
                # vendor restates the year a few months later
                emissions.append({"company_id": cid, "fy_end": f"{fy}-12-31", "scope1_t": round(s1 * rng.uniform(0.85, 1.15)),
                                  "scope2_t": round(s2 * rng.uniform(0.9, 1.1)), "scope3_t": "",
                                  "vendor_load_date": date(fy + 1, 11, 30).isoformat()})
    write("company_financials.csv", financials)
    write("emissions_vendor.csv", emissions)

    # ---------------- instruments ----------------
    instruments = []
    for c in companies:
        instruments.append({"instrument_id": c["company_id"] + "-EQ", "company_id": c["company_id"],
                            "asset_class": "Listed equity", "description": c["company_name"] + " ordinary shares"})
        if rng.random() < 0.45:
            instruments.append({"instrument_id": c["company_id"] + "-BD", "company_id": c["company_id"],
                                "asset_class": "Corporate bond", "description": c["company_name"] + " senior bond"})
    for gov in ["NZGB 2031", "NZGB 2033", "UST 2030", "UST 2034", "ACGB 2032"]:
        instruments.append({"instrument_id": "SOV-" + gov.replace(" ", ""), "company_id": "",
                            "asset_class": "Sovereign bond", "description": gov})
    instruments.append({"instrument_id": "CASH-NZD", "company_id": "", "asset_class": "Cash", "description": "NZD cash"})
    write("instruments.csv", instruments)

    # ---------------- holdings ----------------
    emis_by_co = {}
    for e in emissions:
        emis_by_co.setdefault(e["company_id"], []).append(float(e["scope1_t"]) + float(e["scope2_t"]))
    rev_by_co = {}
    for f in financials:
        rev_by_co.setdefault(f["company_id"], []).append(f["revenue_nzd_m"])
    intensity = {cid: (sum(v) / len(v)) / (sum(rev_by_co[cid]) / len(rev_by_co[cid])) for cid, v in emis_by_co.items()}
    eq = [i for i in instruments if i["asset_class"] == "Listed equity"]
    bd = [i for i in instruments if i["asset_class"] == "Corporate bond"]
    sov = [i for i in instruments if i["asset_class"] == "Sovereign bond"]

    holdings = []
    for fid, (fname, eq_share, aum0, growth, tilt) in FUNDS.items():
        eq_names = rng.sample(eq, 70)
        bd_names = rng.sample(bd, 30)
        base = {i["instrument_id"]: rng.lognormvariate(0, 0.7) for i in eq_names + bd_names}
        for t, rd in enumerate(REPORT_DATES):
            aum = aum0 * (1 + growth) ** t
            cash = aum * 0.03
            sov_total = (aum - cash) * (1 - eq_share) * 0.5
            corp_bd_total = (aum - cash) * (1 - eq_share) - sov_total
            eq_total = aum - cash - sov_total - corp_bd_total

            def alloc(names, total):
                w = {}
                for i in names:
                    x = base[i["instrument_id"]]
                    ci = intensity.get(i["company_id"])
                    if ci is not None:   # tilt away from carbon intensive names over time
                        x *= (1 - tilt) ** (t * min(ci / 300, 3))
                    w[i["instrument_id"]] = x * rng.uniform(0.9, 1.1)
                s = sum(w.values())
                return {k: total * v / s for k, v in w.items()}

            for iid, mv in alloc(eq_names, eq_total).items():
                holdings.append({"fund_id": fid, "report_date": rd.isoformat(), "instrument_id": iid,
                                 "market_value_nzd": round(mv * 1e6, 2), "face_value_nzd": ""})
            for iid, mv in alloc(bd_names, corp_bd_total).items():
                price = rng.uniform(0.92, 1.04)
                holdings.append({"fund_id": fid, "report_date": rd.isoformat(), "instrument_id": iid,
                                 "market_value_nzd": round(mv * 1e6, 2), "face_value_nzd": round(mv * 1e6 / price, 2)})
            for s in sov:
                mv = sov_total / len(sov)
                holdings.append({"fund_id": fid, "report_date": rd.isoformat(), "instrument_id": s["instrument_id"],
                                 "market_value_nzd": round(mv * 1e6, 2), "face_value_nzd": round(mv * 1e6, 2)})
            holdings.append({"fund_id": fid, "report_date": rd.isoformat(), "instrument_id": "CASH-NZD",
                             "market_value_nzd": round(cash * 1e6, 2), "face_value_nzd": ""})
    write("holdings.csv", holdings)
    write("funds.csv", [{"fund_id": k, "fund_name": v[0]} for k, v in FUNDS.items()])


if __name__ == "__main__":
    print(f"Writing synthetic data to {OUT}")
    main()
