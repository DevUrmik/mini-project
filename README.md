# US Accidents Prediction & Hotspot Analytics

Full-stack machine learning and geospatial analytics application built on the nationwide **US Accidents (2016–2023)** dataset (`7,728,394` records across 49 US states and the District of Columbia).

---

## What the Project Does

1. **Overview Dashboard:** Displays nationwide accident volume, severity distribution, hourly patterns, weather breakdowns, top states, and roadway infrastructure prevalence across all `7,728,394` cleaned records.
2. **Hotspot Explorer:** Interactive Leaflet map backed by a `193,209`-record stratified spatial sample across all 49 states + DC, supporting individual accident locations, density heatmaps, K-Means regional centroids, and DBSCAN highway corridors using spherical Haversine distance.
3. **ML Model Analysis:** Reports evaluation metrics (`Accuracy`, `Macro F1`, `Balanced Accuracy`, `Weighted F1`), per-class precision/recall/F1, 4×4 confusion matrix, class distribution, majority-class baseline comparison, and feature importances for the selected `HistGradientBoostingClassifier`.
4. **Accident Severity Prediction:** Predicts accident severity (**Level 1 — Minor Accident** through **Level 4 — Critical Accident**) and Serious/Critical (Level 3–4) risk from pre-incident weather, time (`HH:MM`), state, and roadway inputs.

---

## Dataset Source & Coverage

- **Source:** [US Accidents (2016–2023) on Kaggle](https://www.kaggle.com/datasets/sobhanmoosavi/us-accidents) (`data/raw/US_Accidents_March23.csv`)
- **Time Range:** `2016-02-08` to `2023-03-31`
- **Geographic Coverage:** 49 US states + DC (`20,281` cities)
- **Processed Artifacts:**
  - `data/processed/cleaned_accidents.parquet`: `7,728,394` cleaned records
  - `data/processed/spatial_accidents.parquet`: `193,209` stratified spatial records (2.5% sample for interactive map rendering)
  - `data/processed/ml_sample.parquet`: `108,500` stratified records (plus `500,000` stratified sampling from `cleaned_accidents.parquet` in `scripts/train_classification.py`)

### Standardized Severity Labels

| Level | Label |
| :---: | :--- |
| **1** | Minor Accident |
| **2** | Moderate Accident |
| **3** | Serious Accident |
| **4** | Critical Accident |

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Recharts, Leaflet (`react-leaflet`), Axios, Lucide Icons
- **Backend:** Python 3.12, FastAPI, Pydantic, Pandas, NumPy, PyArrow, Scikit-Learn, Joblib
- **Deployment:** Vercel Services (`vercel.json`)

---

## Project Structure

```text
├── client/                         # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/             # DigitalTimePicker, ErrorBanner, LoadingSkeleton, Navbar, Sidebar, StatCard
│   │   ├── maps/                   # HotspotMap (Leaflet + OpenStreetMap)
│   │   ├── pages/                  # Dashboard, HotspotExplorer, ModelComparison, SeverityPredictor
│   │   ├── services/               # Axios API client (api.ts)
│   │   └── types/                  # TypeScript interfaces
│   └── package.json
├── server/                         # FastAPI backend
│   ├── app/
│   │   ├── ml/                     # Preprocessor pipeline & Haversine math
│   │   ├── routes/                 # analytics, dashboard, geo, hotspots, models, predict
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # DataService, HotspotService, PredictionService
│   │   ├── config.py
│   │   └── main.py
│   ├── data/processed/             # Server-packaged spatial parquet & summary JSONs
│   ├── models/                     # Persisted joblib models, cluster JSONs & model_metrics.json
│   ├── main.py                     # Vercel ASGI entrypoint
│   └── requirements.txt
├── data/
│   ├── raw/                        # Original US_Accidents_March23.csv
│   └── processed/                  # Cleaned Parquet, spatial sample, and summary JSONs
├── models/                         # Trained model artifacts & evaluation JSONs
├── notebooks/                      # Exploratory notebooks
├── scripts/                        # Reproducible preprocessing, clustering & training scripts
├── tests/                          # Pytest suite (test_api.py, test_clustering.py, test_preprocessor.py)
├── vercel.json
└── README.md
```

---

## Setup & Running Locally

### 1. Install Dependencies

**Backend:**
```bash
pip install -r server/requirements.txt
```

**Frontend:**
```bash
npm --prefix client install
```

### 2. Run the Backend

```bash
uvicorn server.app.main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

### 3. Run the Frontend

```bash
npm --prefix client run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` requests to the FastAPI backend.

---

## Machine Learning & Hotspot Detection

- **Accident Severity Classification (`scripts/train_classification.py`):**
  - Uses **28 pre-incident features** (`Start_Lat`, `Start_Lng`, `State`, cyclical `Hour_Sin`/`Hour_Cos` and `Month_Sin`/`Month_Cos`, weather measurements/flags, and roadway infrastructure indicators). Post-incident fields (`End_Time`, `Distance(mi)`) are excluded to prevent data leakage.
  - Trained on a `500,000`-record stratified sample (`400,000` train / `100,000` un-resampled holdout test) using `HistGradientBoostingClassifier` with smoothed inverse-frequency weights ($\alpha = 0.35$).
  - Evaluated metrics on the `100,000`-record test set: **80.75% Accuracy**, **43.61% Macro F1**, **41.13% Balanced Accuracy**, **79.27% Weighted F1** (vs. Majority-Class Baseline: `79.67%` Accuracy, `25.00%` Balanced Accuracy, `22.17%` Macro F1).
  - Secondary binary `HistGradientBoostingClassifier` (Level 3–4 vs. 1–2) achieves **81.52% Accuracy**, **70.05% Balanced Accuracy**, **70.24% Macro F1**, and **81.96% ROC-AUC**.
- **Spatial Hotspot Detection (`scripts/train_clustering_all_states.py`):**
  - Precomputes and dynamically serves **DBSCAN** (`BallTree` with Haversine spherical distance, $\epsilon = 7.5\text{ km}$) and **K-Means** centroids across all 49 states + DC.

---

## Testing & Build

```bash
pytest tests/ -v
npm --prefix client run build
```
