"""
Inspect the raw US Accidents Kaggle dataset
File: data/raw/US_Accidents_March23.csv
"""
import sys
import os
import time
from pathlib import Path
import pandas as pd

def inspect_raw():
    csv_path = Path("data/raw/US_Accidents_March23.csv")
    if not csv_path.exists():
        print(f"[ERROR] File not found: {csv_path}")
        return

    size_bytes = csv_path.stat().st_size
    size_gb = size_bytes / (1024 ** 3)
    print(f"File: {csv_path.name}")
    print(f"Size: {size_bytes:,} bytes ({size_gb:.2f} GB)")

    # Read first 5 rows for header and sample
    sample_df = pd.read_csv(csv_path, nrows=5)
    print(f"\nTotal Columns: {len(sample_df.columns)}")
    print("Columns:")
    for i, col in enumerate(sample_df.columns, 1):
        print(f"  {i:2d}. {col} ({sample_df[col].dtype})")

    # Fast line count using buffered byte reading
    print("\nCounting exact total records across raw CSV...")
    start_time = time.time()
    total_lines = 0
    with open(csv_path, "rb") as f:
        buf_size = 1024 * 1024 * 16  # 16 MB buffer
        while True:
            buf = f.raw.read(buf_size)
            if not buf:
                break
            total_lines += buf.count(b"\n")

    # Minus 1 for header
    total_records = total_lines - 1 if total_lines > 0 else 0
    elapsed = time.time() - start_time
    print(f"Total Lines: {total_lines:,}")
    print(f"Total Accident Records: {total_records:,}")
    print(f"Time taken to scan 3GB file: {elapsed:.2f} seconds")

if __name__ == "__main__":
    inspect_raw()

