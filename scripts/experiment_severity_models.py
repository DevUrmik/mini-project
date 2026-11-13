"""
Accident Severity Classification Experiments: Imbalance & Minority-Class Improvement
Compares:
1. Baseline Class Weighting ('balanced')
2. Random Forest with 'balanced_subsample' & tuned hyper-parameters
3. Training-set Resampling (downsampling dominant class 2, oversampling classes 1 & 4 on train partition ONLY)
4. HistGradientBoostingClassifier with class weights
5. Feature Engineering additions (infrastructure, weather severity flags)

Evaluates on PRISTINE (un-resampled) test partition.
Calculates: Accuracy, Balanced Accuracy, Macro Precision, Macro Recall, Macro F1, Weighted F1,
Per-class Precision/Recall/F1, Confusion Matrices, and Majority-Class Baseline.
"""

import sys
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from server.app.config import ML_SAMPLE_PARQUET_PATH, CLEANED_DATA_PATH
from server.app.ml.preprocessor import (
    create_feature_pipeline,
    ALL_MODEL_FEATURES,
    NUMERICAL_FEATURES,
    CATEGORICAL_FEATURES,
    BOOLEAN_FEATURES
)

def run_experiments():
    print("=" * 80)
    print("ACCIDENT SEVERITY MODELING: CONTROLLED EXPERIMENT SUITE")
    print("=" * 80)

    # 1. Load Data
    data_path = ML_SAMPLE_PARQUET_PATH if ML_SAMPLE_PARQUET_PATH.exists() else CLEANED_DATA_PATH
    print(f"\n[DATA] Loading dataset from {data_path}...")
    df = pd.read_parquet(data_path) if str(data_path).endswith(".parquet") else pd.read_csv(data_path)
    print(f"Total available rows: {len(df):,}")

    class_counts = df["Severity"].value_counts().sort_index().to_dict()
    total_samples = len(df)
    print("Authentic Class Distribution:")
    for k, v in class_counts.items():
        print(f"  Level {k}: {v:,} ({v / total_samples * 100:.2f}%)")

    # 2. Additional Pre-Incident Feature Engineering
    print("\n[FEATURES] Engineering additional pre-incident attributes (zero data leakage)...")
    # Low visibility flag (< 3 miles)
    df["Low_Visibility"] = (df["Visibility(mi)"] <= 3.0).astype(bool)
    # Freezing temperature flag (<= 32 F)
    df["Freezing_Temp"] = (df["Temperature(F)"] <= 32.0).astype(bool)
    # High wind flag (>= 15 mph)
    df["High_Wind"] = (df["Wind_Speed(mph)"] >= 15.0).astype(bool)
    # Month
    if "Month" not in df.columns and "Start_Time" in df.columns:
        df["Month"] = pd.to_datetime(df["Start_Time"]).dt.month.astype(int)

    extended_features = list(ALL_MODEL_FEATURES)
    for extra_col in ["Station", "Railway", "Amenity", "Low_Visibility", "Freezing_Temp", "High_Wind"]:
        if extra_col in df.columns and extra_col not in extended_features:
            extended_features.append(extra_col)

    print(f"Features used ({len(extended_features)}): {extended_features}")

    X = df[extended_features].copy()
    y = df["Severity"].astype(int).values

    # Stratified Train-Test Split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"\nPartition shapes: X_train: {X_train.shape}, X_test: {X_test.shape} (Pristine, non-resampled)")

    # Preprocessing Pipeline
    # Custom pipeline for extended features
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer

    num_cols = [c for c in extended_features if c in NUMERICAL_FEATURES]
    cat_cols = [c for c in extended_features if c in CATEGORICAL_FEATURES]
    bool_cols = [c for c in extended_features if c not in num_cols and c not in cat_cols]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), num_cols),
            ("cat", Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="Unknown")), ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cat_cols),
            ("bool", Pipeline([("cast", FunctionTransformer(lambda x: np.asarray(x, dtype=float))), ("imp", SimpleImputer(strategy="constant", fill_value=0.0))]), bool_cols)
        ],
        remainder="drop"
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    # 3. Baseline 0: Dummy Majority-Class Classifier
    print("\n" + "-" * 70)
    print("BASELINE 0: Majority-Class Classifier (Always predicts Level 2)")
    print("-" * 70)
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train_proc, y_train)
    y_pred_dummy = dummy.predict(X_test_proc)
    acc_dummy = accuracy_score(y_test, y_pred_dummy)
    bal_acc_dummy = balanced_accuracy_score(y_test, y_pred_dummy)
    macro_f1_dummy = f1_score(y_test, y_pred_dummy, average="macro", zero_division=0)
    print(f"Majority-Class Dummy Accuracy: {acc_dummy * 100:.2f}% (Trivially high!)")
    print(f"Majority-Class Dummy Balanced Acc: {bal_acc_dummy * 100:.2f}% (Complete failure on minority)")
    print(f"Majority-Class Dummy Macro F1: {macro_f1_dummy * 100:.2f}%")

    # 4. Training-Set Controlled Resampling Formulation
    print("\n" + "-" * 70)
    print("PREPARING TRAINING-SET-ONLY RESAMPLED PARTITION")
    print("-" * 70)
    # Downsample class 2 in train, and oversample classes 1 & 4
    train_df = pd.DataFrame(X_train_proc)
    train_df["target"] = y_train

    c1 = train_df[train_df["target"] == 1]
    c2 = train_df[train_df["target"] == 2]
    c3 = train_df[train_df["target"] == 3]
    c4 = train_df[train_df["target"] == 4]

    print(f"Original Train Counts: Level 1: {len(c1)}, Level 2: {len(c2)}, Level 3: {len(c3)}, Level 4: {len(c4)}")

    # Target resampled sizes in training set:
    # Reduce class 2 dominance to ~22,000, keep class 3 (~14,500), oversample class 1 to ~3,000, class 4 to ~6,000
    c1_resampled = c1.sample(n=3500, replace=True, random_state=42)
    c2_resampled = c2.sample(n=24000, replace=False, random_state=42)
    c3_resampled = c3.sample(n=min(len(c3), 14500), replace=False, random_state=42)
    c4_resampled = c4.sample(n=6000, replace=True, random_state=42)

    train_resampled = pd.concat([c1_resampled, c2_resampled, c3_resampled, c4_resampled]).sample(frac=1.0, random_state=42)
    X_train_res = train_resampled.drop(columns=["target"]).values
    y_train_res = train_resampled["target"].values.astype(int)

    print(f"Resampled Train Counts: Level 1: {len(c1_resampled)}, Level 2: {len(c2_resampled)}, Level 3: {len(c3_resampled)}, Level 4: {len(c4_resampled)}")
    print(f"Total Resampled Training Rows: {len(train_resampled):,} | Test Set remains 100% untouched ({len(y_test):,} rows)")

    # 5. Candidate Models & Configurations
    experiments = [
        {
            "id": "log_reg_balanced",
            "name": "Logistic Regression (class_weight='balanced')",
            "model": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
            "X_tr": X_train_proc, "y_tr": y_train
        },
        {
            "id": "dt_balanced",
            "name": "Decision Tree (class_weight='balanced')",
            "model": DecisionTreeClassifier(max_depth=12, min_samples_split=20, class_weight="balanced", random_state=42),
            "X_tr": X_train_proc, "y_tr": y_train
        },
        {
            "id": "rf_balanced",
            "name": "Random Forest (class_weight='balanced')",
            "model": RandomForestClassifier(n_estimators=100, max_depth=16, min_samples_split=15, class_weight="balanced", random_state=42, n_jobs=-1),
            "X_tr": X_train_proc, "y_tr": y_train
        },
        {
            "id": "rf_subsample",
            "name": "Random Forest (class_weight='balanced_subsample')",
            "model": RandomForestClassifier(n_estimators=120, max_depth=18, min_samples_split=10, min_samples_leaf=2, class_weight="balanced_subsample", random_state=42, n_jobs=-1),
            "X_tr": X_train_proc, "y_tr": y_train
        },
        {
            "id": "rf_resampled",
            "name": "Random Forest (Trained on Resampled Distribution)",
            "model": RandomForestClassifier(n_estimators=120, max_depth=18, min_samples_split=10, min_samples_leaf=2, random_state=42, n_jobs=-1),
            "X_tr": X_train_res, "y_tr": y_train_res
        },
        {
            "id": "hist_gbm_balanced",
            "name": "HistGradientBoosting (class_weight='balanced')",
            "model": HistGradientBoostingClassifier(max_iter=120, max_depth=12, class_weight="balanced", random_state=42),
            "X_tr": X_train_proc, "y_tr": y_train
        },
        {
            "id": "hist_gbm_resampled",
            "name": "HistGradientBoosting (Trained on Resampled Distribution)",
            "model": HistGradientBoostingClassifier(max_iter=120, max_depth=12, random_state=42),
            "X_tr": X_train_res, "y_tr": y_train_res
        }
    ]

    results = {}
    print("\n" + "=" * 80)
    print("RUNNING SYSTEMATIC EVALUATION BENCHMARK")
    print("=" * 80)

    for exp in experiments:
        m_id = exp["id"]
        m_name = exp["name"]
        clf = exp["model"]
        X_tr = exp["X_tr"]
        y_tr = exp["y_tr"]

        print(f"\nEvaluating: {m_name}...")
        t0 = time.time()
        clf.fit(X_tr, y_tr)
        fit_time = time.time() - t0

        t1 = time.time()
        y_pred = clf.predict(X_test_proc)
        infer_time = time.time() - t1

        acc = float(accuracy_score(y_test, y_pred) * 100)
        bal_acc = float(balanced_accuracy_score(y_test, y_pred) * 100)
        m_prec = float(precision_score(y_test, y_pred, average="macro", zero_division=0) * 100)
        m_rec = float(recall_score(y_test, y_pred, average="macro", zero_division=0) * 100)
        m_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0) * 100)
        w_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0) * 100)

        cm = confusion_matrix(y_test, y_pred, labels=[1, 2, 3, 4]).tolist()

        per_class_metrics = {}
        for c in [1, 2, 3, 4]:
            c_prec = float(precision_score(y_test == c, y_pred == c, zero_division=0) * 100)
            c_rec = float(recall_score(y_test == c, y_pred == c, zero_division=0) * 100)
            c_f1 = float(f1_score(y_test == c, y_pred == c, zero_division=0) * 100)
            c_supp = int(np.sum(y_test == c))
            per_class_metrics[str(c)] = {
                "precision": round(c_prec, 2),
                "recall": round(c_rec, 2),
                "f1": round(c_f1, 2),
                "support": c_supp
            }

        results[m_id] = {
            "id": m_id,
            "name": m_name,
            "accuracy": round(acc, 2),
            "balanced_accuracy": round(bal_acc, 2),
            "macro_precision": round(m_prec, 2),
            "macro_recall": round(m_rec, 2),
            "macro_f1": round(m_f1, 2),
            "weighted_f1": round(w_f1, 2),
            "per_class": per_class_metrics,
            "confusion_matrix": cm,
            "training_time_sec": round(fit_time, 2),
            "inference_time_sec": round(infer_time, 4)
        }

        print(f"  -> Acc: {acc:.2f}% | Bal Acc: {bal_acc:.2f}% | Macro F1: {m_f1:.2f}% | Weighted F1: {w_f1:.2f}%")
        print(f"     Class 1 F1: {per_class_metrics['1']['f1']}% (Rec: {per_class_metrics['1']['recall']}%, Prec: {per_class_metrics['1']['precision']}%)")
        print(f"     Class 4 F1: {per_class_metrics['4']['f1']}% (Rec: {per_class_metrics['4']['recall']}%, Prec: {per_class_metrics['4']['precision']}%)")

    # Output comparison table
    print("\n" + "=" * 80)
    print(f"{'Model':<45} | {'Acc':<6} | {'BalAcc':<6} | {'MacF1':<6} | {'L1-F1':<6} | {'L4-F1':<6}")
    print("-" * 80)
    for r in results.values():
        print(f"{r['name']:<45} | {r['accuracy']:<6.2f} | {r['balanced_accuracy']:<6.2f} | {r['macro_f1']:<6.2f} | {r['per_class']['1']['f1']:<6.2f} | {r['per_class']['4']['f1']:<6.2f}")
    print("=" * 80)

    # Save experimental findings
    exp_file = REPO_ROOT / "models" / "experiment_findings.json"
    with open(exp_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[OUTPUT] Experimental benchmark saved to {exp_file}")

if __name__ == "__main__":
    run_experiments()

