"""Run the climate disclosure warehouse end to end.

    python src/pipeline.py                      # synthetic data in data/raw
    python src/pipeline.py --raw path/to/files  # your own files, same layout

Steps:
  1. run the SQL files in sql/ in order, into a DuckDB database
  2. log row counts and null counts for every table built
  3. run the data quality checks and stop if any 'error' check fails
  4. export results to output/ and the dashboard data to docs/data.js
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
SQL_DIR = ROOT / "sql"

# Columns whose nulls are worth reporting in the run log
NULL_WATCH = {
    "dim.financials": ["evic_nzd_m", "revenue_nzd_m"],
    "fact.holding": ["company_emissions_t", "evic_nzd_m"],
    "fact.portfolio_metrics": ["carbon_footprint_t_per_m", "waci_t_per_revenue_m"],
}


def run(raw: Path, db_path: Path, out_dir: Path | None = None, docs_dir: Path | None = None, quiet: bool = False) -> duckdb.DuckDBPyConnection:
    say = (lambda *a: None) if quiet else print
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    con = duckdb.connect(str(db_path))
    con.execute("CREATE SCHEMA IF NOT EXISTS meta")
    con.execute("""CREATE TABLE meta.run_log (step VARCHAR, table_name VARCHAR, row_count BIGINT,
                   null_column VARCHAR, null_count BIGINT, seconds DOUBLE, logged_at TIMESTAMP)""")

    raw_path = raw.resolve().as_posix()
    for sql_file in sorted(SQL_DIR.glob("*.sql")):
        t0 = time.perf_counter()
        text = sql_file.read_text()
        con.execute(text.replace("{{RAW}}", raw_path))
        secs = time.perf_counter() - t0
        built = re.findall(r"CREATE OR REPLACE TABLE ([a-z_]+\.[a-z_]+)", text, flags=re.I)
        for t in built:
            n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            con.execute("INSERT INTO meta.run_log VALUES (?, ?, ?, NULL, NULL, ?, ?)",
                        [sql_file.name, t, n, secs, datetime.now()])
            for col in NULL_WATCH.get(t, []):
                nulls = con.execute(f"SELECT COUNT(*) FROM {t} WHERE {col} IS NULL").fetchone()[0]
                con.execute("INSERT INTO meta.run_log VALUES (?, ?, NULL, ?, ?, NULL, ?)",
                            [sql_file.name, t, col, nulls, datetime.now()])
        say(f"  {sql_file.name:<24} {secs:6.2f}s  " + ", ".join(
            f"{t} ({con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]:,})" for t in built))

    dq = con.execute("SELECT check_id, severity, description, failures FROM dq.results").fetchall()
    say("\nData quality checks")
    for cid, sev, desc, fails in dq:
        status = "PASS" if fails == 0 else ("FAIL" if sev == "error" else "WARN")
        say(f"  {cid} {status:<4} {fails:>4}  {desc}")
    errors = [r for r in dq if r[1] == "error" and r[3] > 0]
    if errors:
        raise RuntimeError(f"{len(errors)} data quality check(s) failed: " + ", ".join(r[0] for r in errors))

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        for t in ["fact.portfolio_metrics", "fact.top_contributors", "dq.results", "meta.run_log"]:
            con.execute(f"COPY {t} TO '{(out_dir / (t.split('.')[1] + '.csv')).as_posix()}' (HEADER)")
        say(f"\nResults written to {out_dir}")
    if docs_dir:
        export_dashboard_data(con, docs_dir)
        say(f"Dashboard data written to {docs_dir / 'data.js'}")
    return con


def export_dashboard_data(con, docs_dir: Path) -> None:
    def rows(sql):
        cur = con.execute(sql)
        cols = [d[0] for d in cur.description]
        return [{c: (v.isoformat() if hasattr(v, "isoformat") else v) for c, v in zip(cols, r)} for r in cur.fetchall()]

    data = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "metrics": rows("SELECT * FROM fact.portfolio_metrics ORDER BY fund_id, report_date, scope, asset_class"),
        "top": rows("SELECT * FROM fact.top_contributors ORDER BY fund_id, rank"),
        "dq": rows("SELECT * FROM dq.results"),
        "sectors": rows("""
            SELECT fund_id, report_date, sector, SUM(financed_emissions_t) AS financed_emissions_t,
                   SUM(market_value_nzd) AS market_value_nzd
            FROM fact.holding WHERE scope = 'Scope 1+2' AND covered_evic
            GROUP BY ALL ORDER BY fund_id, report_date, financed_emissions_t DESC"""),
    }
    docs_dir.mkdir(parents=True, exist_ok=True)
    (docs_dir / "data.js").write_text("window.CDW_DATA = " + json.dumps(data, default=float) + ";\n")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--raw", type=Path, default=ROOT / "data" / "raw", help="folder with the input CSV files")
    p.add_argument("--db", type=Path, default=ROOT / "output" / "warehouse.duckdb", help="DuckDB file to build")
    p.add_argument("--out", type=Path, default=ROOT / "output", help="folder for result CSVs")
    p.add_argument("--docs", type=Path, default=ROOT / "docs", help="folder for the dashboard data file")
    a = p.parse_args()
    print(f"Building {a.db} from {a.raw}\n")
    try:
        run(a.raw, a.db, a.out, a.docs)
    except RuntimeError as e:
        print(f"\nStopped: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
