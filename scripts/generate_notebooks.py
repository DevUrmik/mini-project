"""
Generates the three required Jupyter Notebooks with markdown commentary and code:
1. 01_data_exploration.ipynb
2. 02_hotspot_clustering.ipynb
3. 03_severity_classification.ipynb
"""

import json
from pathlib import Path

NOTEBOOKS_DIR = Path("notebooks")
NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)

def create_notebook(cells):
    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "codemirror_mode": {"name": "ipython", "version": 3},
                "file_extension": ".py",
                "mimetype": "text/x-python",
                "name": "python",
                "nbconvert_exporter": "python",
                "pygments_lexer": "ipython3",
                "version": "3.12.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }

def markdown_cell(source):
    lines = [line + "\n" for line in source.split("\n")]
    if lines and lines[-1].endswith("\n"):
        lines[-1] = lines[-1][:-1]
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": lines
    }

def code_cell(source):
    lines = [line + "\n" for line in source.split("\n")]
    if lines and lines[-1].endswith("\n"):
        lines[-1] = lines[-1][:-1]
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines
    }

# -----------------------------------------------------------------------------
# Notebook 1: 01_data_exploration.ipynb
# -----------------------------------------------------------------------------
nb1_cells = [
    markdown_cell("""# Day 1: Exploratory Data Analysis & Feature Engineering
## Accident Hotspot Prediction and Road Safety Intelligence System

**Dataset:** US Accidents (2016 - 2023) by Sobhan Moosavi  
**Key Note:** The `Severity` scale represents **traffic delay impact** (1 = short delay, 4 = long disruption), **not fatality or injury severity**.

### Notebook Objectives:
1. Inspect dataset dimensions, data types, and missing value profiles.
2. Remove duplicates and validate geospatial boundaries (continental US).
3. Convert timestamps and engineer temporal indicators (`Hour`, `Day_OfWeek`, `Is_Rush_Hour`, `Is_Weekend`).
4. Analyze severity distribution and examine class imbalance.
5. Explore weather conditions and infrastructure feature prevalence."""),
    code_cell("""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Configure display
pd.set_option('display.max_columns', 50)
%matplotlib inline
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')"""),
    code_cell("""# 1. Load Processed Dataset
data_path = Path('../data/processed/cleaned_accidents.csv')
if not data_path.exists():
    data_path = Path('data/processed/cleaned_accidents.csv')

df = pd.read_csv(data_path)
print(f"Loaded {len(df):,} accident records with {df.shape[1]} columns.")
df.head(3)"""),
    code_cell("""# 2. Inspect Target Variable: Traffic Delay Severity
print("Severity Frequency Distribution:")
print(df['Severity'].value_counts().sort_index())
print("\\nNormalized Class Proportions:")
print(df['Severity'].value_counts(normalize=True).sort_index().round(4))"""),
    code_cell("""# Plot Severity Distribution
plt.figure(figsize=(7, 4))
colors = ['#38bdf8', '#3b82f6', '#f59e0b', '#ef4444']
counts = df['Severity'].value_counts().sort_index()
plt.bar([f'Severity {k}' for k in counts.index], counts.values, color=colors)
plt.title('Distribution of Accident Severity (Traffic Delay Scale)')
plt.ylabel('Number of Accidents')
plt.xlabel('Severity Category')
plt.show()"""),
    code_cell("""# 3. Temporal Distribution: Commute Rush Hour Impact
hourly_accidents = df.groupby('Hour')['ID'].count()

plt.figure(figsize=(10, 4))
plt.plot(hourly_accidents.index, hourly_accidents.values, marker='o', color='#3b82f6', linewidth=2)
plt.axvspan(7, 9, color='#fbbf24', alpha=0.3, label='Morning Rush (7-9 AM)')
plt.axvspan(16, 18, color='#f87171', alpha=0.3, label='Evening Rush (4-6 PM)')
plt.title('Accident Frequency by Hour of Day')
plt.xlabel('Hour (00:00 - 23:00)')
plt.ylabel('Accident Count')
plt.xticks(range(0, 24))
plt.legend()
plt.show()"""),
    code_cell("""# 4. Infrastructure Features Breakdown
infra_cols = ['Junction', 'Crossing', 'Traffic_Signal', 'Stop']
infra_pcts = {col: df[col].mean() * 100 for col in infra_cols}

plt.figure(figsize=(8, 4))
plt.bar(infra_pcts.keys(), infra_pcts.values(), color='#10b981')
plt.title('Prevalence of Road Infrastructure Features in Accidents')
plt.ylabel('Percentage of Accidents (%)')
for col, val in infra_pcts.items():
    plt.text(col, val + 0.5, f"{val:.1f}%", ha='center', fontweight='bold')
plt.ylim(0, max(infra_pcts.values()) + 5)
plt.show()""")
]

with open(NOTEBOOKS_DIR / "01_data_exploration.ipynb", "w") as f:
    json.dump(create_notebook(nb1_cells), f, indent=2)

# -----------------------------------------------------------------------------
# Notebook 2: 02_hotspot_clustering.ipynb
# -----------------------------------------------------------------------------
nb2_cells = [
    markdown_cell("""# Day 2: Spatial Clustering & Hotspot Identification
## K-Means vs. DBSCAN with Haversine Spherical Metric

### Theoretical Motivation:
Accident hotspots are geographic concentrations of historical accidents.
1. **The Haversine Metric:** Latitude and longitude are angular coordinates on a sphere. Treating them as flat Euclidean $(x, y)$ coordinates introduces distortion. The Haversine formula calculates the true great-circle distance:
$$d = 2R \\arcsin\\left(\\sqrt{\\sin^2\\left(\\frac{\\Delta \\phi}{2}\\right) + \\cos(\\phi_1)\\cos(\\phi_2)\\sin^2\\left(\\frac{\\Delta \\lambda}{2}\\right)}\\right)$$
2. **K-Means vs DBSCAN:**
- **K-Means** requires specifying $K$ upfront and forces all points (including remote rural accidents) into spherical clusters.
- **DBSCAN** discovers clusters of arbitrary geometric shape (e.g. winding freeways) and labels isolated events as noise."""),
    code_cell("""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans, DBSCAN
from pathlib import Path

EARTH_RADIUS_KM = 6371.0088

# Load California subset
ca_path = Path('../data/processed/california_accidents.csv')
if not ca_path.exists():
    ca_path = Path('data/processed/california_accidents.csv')

df_ca = pd.read_csv(ca_path)
print(f"Loaded {len(df_ca):,} California accident records for clustering.")"""),
    code_cell("""# 1. Evaluate K-Means Inertia for Multiple K
coords = df_ca[['Start_Lat', 'Start_Lng']].values[:15000]

k_range = [5, 8, 10, 15, 20]
inertias = []

for k in k_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    km.fit(coords)
    inertias.append(km.inertia_)
    print(f"K = {k:2d} -> Inertia: {km.inertia_:.2f}")

plt.figure(figsize=(7, 4))
plt.plot(k_range, inertias, marker='s', color='#6366f1', linewidth=2)
plt.title('K-Means Elbow Curve (Inertia vs K)')
plt.xlabel('Number of Clusters (K)')
plt.ylabel('Inertia (Sum of Squared Distances)')
plt.show()"""),
    code_cell("""# 2. DBSCAN Clustering with Spherical Haversine Metric
# Convert coordinates to radians
coords_rad = np.radians(coords)

# Configure DBSCAN: eps = 7.5 km in radians, min_samples = 35
eps_km = 7.5
eps_rad = eps_km / EARTH_RADIUS_KM
min_samples = 35

dbscan = DBSCAN(eps=eps_rad, min_samples=min_samples, metric='haversine', algorithm='ball_tree')
db_labels = dbscan.fit_predict(coords_rad)

n_clusters = len(set(db_labels) - {-1})
n_noise = np.sum(db_labels == -1)

print(f"DBSCAN Results:")
print(f"- Dense Clusters Identified: {n_clusters}")
print(f"- Noise / Outlier Points: {n_noise} ({n_noise / len(coords) * 100:.2f}%)")"""),
    code_cell("""# 3. Visualize Spatial Clusters (California)
plt.figure(figsize=(9, 7))
plt.scatter(coords[db_labels == -1, 1], coords[db_labels == -1, 0], c='gray', s=5, alpha=0.2, label='Noise (Isolated)')
plt.scatter(coords[db_labels != -1, 1], coords[db_labels != -1, 0], c=db_labels[db_labels != -1], cmap='tab10', s=12, alpha=0.7)
plt.title('DBSCAN Haversine Clustering: California Accident Hotspots')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.legend()
plt.show()""")
]

with open(NOTEBOOKS_DIR / "02_hotspot_clustering.ipynb", "w") as f:
    json.dump(create_notebook(nb2_cells), f, indent=2)

# -----------------------------------------------------------------------------
# Notebook 3: 03_severity_classification.ipynb
# -----------------------------------------------------------------------------
nb3_cells = [
    markdown_cell("""# Day 3 & 4: Accident Severity Classification & Model Evaluation
## Logistic Regression, Decision Tree, and Random Forest Classifiers

### ML Workflow:
1. **Target Formulation:** Multi-class classification on `Severity` (Classes 1, 2, 3, 4).
2. **Data Leakage Prevention:** Outcome indicators such as `End_Time`, `Duration_Minutes`, and `Distance(mi)` are strictly excluded.
3. **Preprocessing Pipeline:** Scikit-Learn `ColumnTransformer` with median imputation, feature scaling, and one-hot encoding.
4. **Stratified Split:** 80% train, 20% test preserving class proportions.
5. **Evaluation:** Accuracy, Balanced Accuracy, Precision, Recall, Macro F1, and Confusion Matrices."""),
    code_cell("""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import joblib

# Load trained metrics
metrics_path = Path('../models/model_metrics.json')
if not metrics_path.exists():
    metrics_path = Path('models/model_metrics.json')

import json
with open(metrics_path) as f:
    eval_data = json.load(f)

print(f"Best Performing Model: {eval_data['selected_best_model']}")"""),
    code_cell("""# 1. Compare Core Evaluation Metrics
models_df = pd.DataFrame(eval_data['models']).T
display_cols = ['name', 'accuracy', 'balanced_accuracy', 'macro_f1', 'weighted_f1']
models_df[display_cols]"""),
    code_cell("""# Plot Model Metric Comparison Bar Chart
fig, ax = plt.subplots(figsize=(9, 4))
x = np.arange(len(models_df))
width = 0.25

ax.bar(x - width, models_df['accuracy'], width, label='Accuracy (%)', color='#3b82f6')
ax.bar(x, models_df['balanced_accuracy'], width, label='Balanced Acc (%)', color='#10b981')
ax.bar(x + width, models_df['macro_f1'], width, label='Macro F1 (%)', color='#f59e0b')

ax.set_ylabel('Score (%)')
ax.set_title('Model Performance Benchmark: Handling Class Imbalance')
ax.set_xticks(x)
ax.set_xticklabels(models_df['name'])
ax.legend()
plt.show()"""),
    code_cell("""# 2. Random Forest Feature Importances
feat_df = pd.DataFrame(eval_data['feature_importances'])

plt.figure(figsize=(10, 5))
plt.barh(feat_df['feature'][::-1], feat_df['importance'][::-1], color='#6366f1')
plt.title('Top 15 Predictive Features for Accident Severity (Random Forest)')
plt.xlabel('Gini Feature Importance (%)')
plt.tight_layout()
plt.show()"""),
    code_cell("""# 3. Confusion Matrix Analysis (Random Forest)
rf_cm = np.array(eval_data['models']['random_forest']['confusion_matrix'])

plt.figure(figsize=(6, 5))
sns.heatmap(rf_cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=[f'Pred {i}' for i in range(1, 5)],
            yticklabels=[f'Actual {i}' for i in range(1, 5)])
plt.title('Random Forest Confusion Matrix')
plt.xlabel('Predicted Severity')
plt.ylabel('Actual Severity')
plt.show()""")
]

with open(NOTEBOOKS_DIR / "03_severity_classification.ipynb", "w") as f:
    json.dump(create_notebook(nb3_cells), f, indent=2)

print("[SUCCESS] All 3 Jupyter Notebooks generated in notebooks/")

