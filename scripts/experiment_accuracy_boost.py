"""
Controlled Accuracy & Minority-Class Improvement Experiments
Tests:
1. Feature Expansion: 13 -> 27 zero-leakage pre-incident features (Spatial Lat/Lng/State, Cyclical Hour/Month, Infra flags, Weather flags)
2. Larger Stratified Sample: 500,000 rows sampled from the full 7.73M cleaned_accidents.parquet
3. Smoothed Class Weighting (alpha = 0.0, 0.35, 0.50, 1.0) on HistGradientBoosting & RandomForest
4. Binary Operational Formulation: High Impact (Severity 3-4) vs Standard (Severity 1-2)

Evaluates strictly on a pristine, un-resampled 20% holdout test set (100,000 rows).
"""

import time
import json
from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer, OrdinalEncoder
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
CLEANED_PARQUET = REPO_ROOT / "data" / "processed" / "cleaned_accidents.parquet"
OUT_PATH = REPO_ROOT / "models" / "accuracy_boost_experiments.json"

REQUIRED_COLS = [
    "Severity", "Start_Lat", "Start_Lng", "State",
    "Temperature(F)", "Humidity(%)", "Visibility(mi)", "Wind_Speed(mph)",
    "Weather_Condition", "Hour", "Day_OfWeek", "Month",
    "Is_Rush_Hour", "Is_Weekend",
    "Junction", "Crossing", "Traffic_Signal", "Stop",
    "Amenity", "Give_Way", "Railway", "Station"
]

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    hour = pd.to_numeric(out["Hour"], errors="coerce").fillna(12.0)
    month = pd.to_numeric(out["Month"], errors="coerce").fillna(6.0)
    out["Hour_Sin"] = np.sin(2 * np.pi * hour / 24.0)
    out["Hour_Cos"] = np.cos(2 * np.pi * hour / 24.0)
    out["Month_Sin"] = np.sin(2 * np.pi * month / 12.0)
    out["Month_Cos"] = np.cos(2 * np.pi * month / 12.0)
    out["Low_Visibility"] = (pd.to_numeric(out["Visibility(mi)"], errors="coerce").fillna(10.0) <= 3.0).astype(float)
    out["Freezing_Temp"] = (pd.to_numeric(out["Temperature(F)"], errors="coerce").fillna(65.0) <= 32.0).astype(float)
    out["High_Wind"] = (pd.to_numeric(out["Wind_Speed(mph)"], errors="coerce").fillna(5.0) >= 15.0).astype(float)
    return out

def compute_smoothed_sample_weights(y: np.ndarray, alpha: float) -> np.ndarray:
    if alpha <= 0.0:
        return np.ones(len(y), dtype=float)
    classes, counts = np.unique(y, return_counts=True)
    n = len(y)
    k = len(classes)
    weights_map = {c: (n / (k * cnt)) ** alpha for c, cnt in zip(classes, counts)}
    return np.array([weights_map[val] for val in y], dtype=float)

def eval_multiclass(name: str, y_test: np.ndarray, y_pred: np.ndarray, fit_sec: float) -> dict:
    classes = [1, 2, 3, 4]
    acc = round(float(accuracy_score(y_test, y_pred) * 100), 2)
    bal = round(float(balanced_accuracy_score(y_test, y_pred) * 100), 2)
    mf1 = round(float(f1_score(y_test, y_pred, average="macro", zero_division=0) * 100), 2)
    wf1 = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0) * 100), 2)
    per_class = {}
    for c in classes:
        per_class[str(c)] = {
            "precision": round(float(precision_score(y_test == c, y_pred == c, zero_division=0) * 100), 2),
            "recall": round(float(recall_score(y_test == c, y_pred == c, zero_division=0) * 100), 2),
            "f1": round(float(f1_score(y_test == c, y_pred == c, zero_division=0) * 100), 2),
        }
    cm = confusion_matrix(y_test, y_pred, labels=classes).tolist()
    print(f"  {name:48s} | Acc: {acc:5.2f}% | BalAcc: {bal:5.2f}% | MacroF1: {mf1:5.2f}% | WtF1: {wf1:5.2f}% | C1_F1: {per_class['1']['f1']:5.2f}% | C4_F1: {per_class['4']['f1']:5.2f}% ({fit_sec:.1f}s)")
    return {
        "name": name, "accuracy": acc, "balanced_accuracy": bal,
        "macro_f1": mf1, "weighted_f1": wf1,
        "per_class": per_class, "confusion_matrix": cm,
        "fit_sec": round(fit_sec, 2)
    }

def main():
    t0 = time.time()
    print(f"Loading columns from {CLEANED_PARQUET}...")
    df_full = pd.read_parquet(CLEANED_PARQUET, columns=REQUIRED_COLS)
    print(f"Loaded {len(df_full):,} rows in {time.time() - t0:.2f}s. Sampling 500,000 stratified rows...")

    df_sample, _ = train_test_split(
        df_full, train_size=500_000, random_state=42, stratify=df_full["Severity"]
    )
    del df_full
    df_sample = engineer_features(df_sample)

    num_cols = [
        "Start_Lat", "Start_Lng",
        "Temperature(F)", "Humidity(%)", "Visibility(mi)", "Wind_Speed(mph)",
        "Hour", "Month", "Hour_Sin", "Hour_Cos", "Month_Sin", "Month_Cos"
    ]
    cat_cols = ["State", "Weather_Condition", "Day_OfWeek"]
    bool_cols = [
        "Junction", "Crossing", "Traffic_Signal", "Stop",
        "Is_Rush_Hour", "Is_Weekend",
        "Amenity", "Give_Way", "Railway", "Station",
        "Low_Visibility", "Freezing_Temp", "High_Wind"
    ]
    all_cols = num_cols + cat_cols + bool_cols

    X = df_sample[all_cols]
    y = df_sample["Severity"].astype(int).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train):,} | Test: {len(X_test):,}")

    # 1) Ordinal-encoded pipeline for HistGradientBoosting (fast, native categorical support, zero huge one-hot)
    hgb_pre = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), num_cols),
            ("cat", Pipeline([
                ("imp", SimpleImputer(strategy="constant", fill_value="Unknown")),
                ("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1, encoded_missing_value=-1))
            ]), cat_cols),
            ("bool", Pipeline([
                ("cast", FunctionTransformer(lambda x: np.asarray(x, dtype=float))),
                ("imp", SimpleImputer(strategy="constant", fill_value=0.0))
            ]), bool_cols),
        ],
        remainder="drop"
    )
    X_train_hgb = hgb_pre.fit_transform(X_train)
    X_test_hgb = hgb_pre.transform(X_test)
    cat_mask = [False]*len(num_cols) + [True]*len(cat_cols) + [False]*len(bool_cols)

    # 2) One-hot pipeline for RF / LR / DT
    ohe_pre = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
            ("cat", Pipeline([
                ("imp", SimpleImputer(strategy="constant", fill_value="Unknown")),
                ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=45))
            ]), cat_cols),
            ("bool", Pipeline([
                ("cast", FunctionTransformer(lambda x: np.asarray(x, dtype=float))),
                ("imp", SimpleImputer(strategy="constant", fill_value=0.0))
            ]), bool_cols),
        ],
        remainder="drop"
    )
    X_train_ohe = ohe_pre.fit_transform(X_train)
    X_test_ohe = ohe_pre.transform(X_test)
    print(f"HGB features: {X_train_hgb.shape[1]} | OHE features: {X_train_ohe.shape[1]}")

    results_4class = {}
    print("\n=== 4-CLASS SEVERITY EXPERIMENTS (500k sample, 100k test) ===")
    dummy = DummyClassifier(strategy="most_frequent").fit(X_train_hgb, y_train)
    results_4class["majority"] = eval_multiclass("Majority Baseline", y_test, dummy.predict(X_test_hgb), 0.0)

    for alpha in [0.0, 0.35, 0.5, 1.0]:
        t1 = time.time()
        sw = compute_smoothed_sample_weights(y_train, alpha)
        clf = HistGradientBoostingClassifier(
            max_iter=300, max_leaf_nodes=63, learning_rate=0.08,
            min_samples_leaf=25, categorical_features=cat_mask, random_state=42
        )
        clf.fit(X_train_hgb, y_train, sample_weight=sw)
        y_pred = clf.predict(X_test_hgb)
        key = f"hgb_alpha_{alpha}"
        results_4class[key] = eval_multiclass(f"HistGBM (27-feat, weight alpha={alpha})", y_test, y_pred, time.time() - t1)

    # Random Forest with smoothed weights vs balanced_subsample on 27 features
    for label, cw in [("RF (27-feat, unweighted)", None), ("RF (27-feat, balanced_subsample)", "balanced_subsample")]:
        t1 = time.time()
        rf = RandomForestClassifier(
            n_estimators=100, max_depth=22, min_samples_leaf=5,
            class_weight=cw, random_state=42, n_jobs=-1
        )
        rf.fit(X_train_ohe, y_train)
        y_pred = rf.predict(X_test_ohe)
        results_4class[label] = eval_multiclass(label, y_test, y_pred, time.time() - t1)

    # Binary High-Impact (Severity 3-4) vs Standard (Severity 1-2)
    print("\n=== BINARY HIGH-IMPACT (3-4) vs STANDARD (1-2) EXPERIMENTS ===")
    y_train_bin = (y_train >= 3).astype(int)
    y_test_bin = (y_test >= 3).astype(int)
    results_binary = {}

    for alpha in [0.0, 0.5, 1.0]:
        t1 = time.time()
        sw_bin = compute_smoothed_sample_weights(y_train_bin, alpha)
        clf_bin = HistGradientBoostingClassifier(
            max_iter=300, max_leaf_nodes=63, learning_rate=0.08,
            min_samples_leaf=25, categorical_features=cat_mask, random_state=42
        )
        clf_bin.fit(X_train_hgb, y_train_bin, sample_weight=sw_bin)
        probs = clf_bin.predict_proba(X_test_hgb)[:, 1]
        preds = (probs >= 0.5).astype(int)
        acc = round(float(accuracy_score(y_test_bin, preds) * 100), 2)
        bal = round(float(balanced_accuracy_score(y_test_bin, preds) * 100), 2)
        f1_hi = round(float(f1_score(y_test_bin, preds, pos_label=1) * 100), 2)
        rec_hi = round(float(recall_score(y_test_bin, preds, pos_label=1) * 100), 2)
        prec_hi = round(float(precision_score(y_test_bin, preds, pos_label=1) * 100), 2)
        auc = round(float(roc_auc_score(y_test_bin, probs) * 100), 2)
        mf1 = round(float(f1_score(y_test_bin, preds, average="macro") * 100), 2)
        cm = confusion_matrix(y_test_bin, preds).tolist()
        name = f"HistGBM Binary (alpha={alpha})"
        print(f"  {name:35s} | Acc: {acc:5.2f}% | BalAcc: {bal:5.2f}% | MacroF1: {mf1:5.2f}% | HighImp F1: {f1_hi:5.2f}% (P={prec_hi:5.2f}%, R={rec_hi:5.2f}%) | ROC-AUC: {auc:5.2f}% ({time.time()-t1:.1f}s)")
        results_binary[f"hgb_bin_alpha_{alpha}"] = {
            "name": name, "accuracy": acc, "balanced_accuracy": bal, "macro_f1": mf1,
            "high_impact_precision": prec_hi, "high_impact_recall": rec_hi,
            "high_impact_f1": f1_hi, "roc_auc": auc, "confusion_matrix": cm
        }

    with open(OUT_PATH, "w") as f:
        json.dump({"four_class": results_4class, "binary": results_binary}, f, indent=2)
    print(f"\nSaved experiment results to {OUT_PATH}")

if __name__ == "__main__":
    main()
