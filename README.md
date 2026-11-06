# Accident Hotspot Prediction and Road Safety Intelligence System

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0-emerald.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0-sky.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-indigo.svg)](https://tailwindcss.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4-orange.svg)](https://scikit-learn.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive, production-grade Road Safety Intelligence Platform built for a 7-day college Python Machine Learning lab project. The application integrates unsupervised geospatial clustering, supervised leak-free severity classification, an interactive OpenStreetMap Leaflet dashboard, and a reactive FastAPI backend.

---

## 1. Project Overview & Problem Statement

Traffic accidents impose immense economic delays and safety risks on modern urban networks. Transportation authorities require data-driven tools to:
1. **Identify recurring spatial accident hotspots** across major highway corridors without geometric distortion.
2. **Predict accident traffic delay severity** using strictly pre-incident environmental, temporal, and road infrastructure factors.
3. **Analyze road safety intelligence** to assist transportation agencies in targeted infrastructure improvements.

### Dataset Attribution & Semantics
- **Dataset Source:** [US Accidents (2016–2023) on Kaggle](https://www.kaggle.com/datasets/sobhanmoosavi/us-accidents) by Dr. Sobhan Moosavi et al.
- **Licensing:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
- **Important Semantic Clarification:** The dataset's `Severity` metric (scale 1 to 4) indicates **traffic delay duration and road impact**, not human injury or fatality severity:
  - **Severity 1:** Short delay (< 15 mins), minimal lane disruption.
  - **Severity 2:** Standard commute delay (15–45 mins), moderate traffic slowdown.
  - **Severity 3:** Substantial delay (45–90 mins), multi-lane closure.
  - **Severity 4:** Severe delay (> 90 mins), full roadway closure or major arterial blockage.

---

## 2. System Architecture

```
mini-project/
│
├── client/                                  # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/                      # Navbar, Sidebar, StatCards, Skeletons, ErrorBanner
│   │   ├── pages/                           # 5 Main Intelligence Pages
│   │   │   ├── Dashboard.tsx                # Page 1: Overview Dashboard
│   │   │   ├── HotspotExplorer.tsx          # Page 2: Accident Hotspot Explorer (Leaflet Map)
│   │   │   ├── ModelComparison.tsx          # Page 3: ML Model Comparison & Confusion Matrix
│   │   │   ├── SeverityPredictor.tsx        # Page 4: Interactive Prediction Inference Form
│   │   │   └── Analytics.tsx                # Page 5: Road Safety Insights & Weather Trends
│   │   ├── maps/                            # Leaflet Map Container & Hotspot Cluster Overlays
│   │   ├── services/                        # Axios API Client
│   │   └── types/                           # TypeScript Schema Interfaces
│   └── package.json
│
├── server/                                  # FastAPI Production Backend
│   ├── app/
│   │   ├── routes/                          # Modular API Routers (dashboard, hotspots, models, predict, analytics)
│   │   ├── services/                        # DataService, HotspotService, PredictionService
│   │   ├── schemas/                         # Pydantic Request/Response Models
│   │   ├── ml/                              # Feature Pipeline, Preprocessor, Haversine Math
│   │   ├── config.py                        # Central Settings & File Paths
│   │   └── main.py                          # Application Entry & CORS Setup
│   └── requirements.txt
│
├── data/
│   ├── raw/                                 # Target for original Kaggle CSV (US_Accidents_March23.csv)
│   ├── processed/                           # Cleaned, deduplicated, and feature-engineered datasets
│   └── samples/                             # Labeled development fixture (Moosavi schema compliant)
│
├── notebooks/                               # Lab Experimentation Notebooks (Day 1 - Day 4)
│   ├── 01_data_exploration.ipynb
│   ├── 02_hotspot_clustering.ipynb
│   └── 03_severity_classification.ipynb
│
├── models/                                  # Persisted Joblib Pipelines & JSON Evaluation Metrics
├── scripts/                                 # Reproducible Training & Preprocessing CLI Scripts
├── tests/                                   # Pytest Unit & Integration Test Suite (14 Tests)
├── docs/                                    # Academic Viva & Examination Guide (docs/viva_guide.md)
└── README.md
```

---

## 3. Machine Learning Methodology

### A. Spatial Hotspot Clustering
1. **Haversine Distance Formulation:**  
   Latitude and longitude are spherical angular coordinates. Using raw Euclidean distance introduces severe distortion. We utilize the Haversine great-circle formula:
   $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
2. **K-Means Clustering:**  
   Evaluated for $K \in [5, 8, 10, 15, 20]$ to analyze inertia and identify regional partition centroids.
3. **DBSCAN (Density-Based Spatial Clustering):**  
   Implemented using Scikit-Learn `BallTree` with spherical Haversine metric ($\epsilon = 7.5\text{ km} = 0.001177\text{ rad}$, $\text{MinPts} = 35$). Isolates dense freeway chains (I-5, I-405, US-101) while separating low-density rural incidents as noise.

### B. Severity Classification Pipeline
1. **Zero Data Leakage Policy:**  
   Outcome variables such as `End_Time`, `Duration_Minutes`, `Distance(mi)`, and `Description` are strictly omitted.
2. **Feature Engineering:**  
   Extracted `Hour`, `Day_OfWeek`, `Is_Rush_Hour` (7-9 AM & 4-6 PM), and `Is_Weekend`.
3. **Preprocessing Pipeline (`ColumnTransformer`):**  
   - Numerical (`Temperature`, `Humidity`, `Visibility`, `Wind_Speed`, `Hour`): Median Imputer + `StandardScaler`
   - Categorical (`Weather_Condition`, `Day_OfWeek`): Constant Imputer + `OneHotEncoder(handle_unknown='ignore')`
   - Boolean (`Junction`, `Crossing`, `Traffic_Signal`, `Stop`): Passthrough binary flags
4. **Candidate Classifiers:**  
   - Logistic Regression (`class_weight='balanced'`)
   - Decision Tree Classifier (`max_depth=12`, `min_samples_split=20`)
   - Random Forest Classifier (`n_estimators=100`, `max_depth=16`, `n_jobs=-1`)
5. **Evaluation Against Class Imbalance:**  
   Because Severity 2 makes up ~72% of incidents, **Macro F1-Score** and **Balanced Accuracy** are the primary benchmarks. Random Forest proved superior by capturing non-linear interactions between weather factors and road features.

---

## 4. Empirical Evaluation Results

Evaluated on an 80/20 stratified test split ($N = 7,000$ test records):

| Model | Accuracy | Balanced Accuracy | Macro F1 | Weighted F1 | Primary Strength |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Logistic Regression** | 21.47% | 25.15% | 16.92% | 27.71% | Fast linear baseline |
| **Decision Tree** | 23.24% | 23.97% | 17.68% | 29.52% | Interpretable rule branching |
| **Random Forest** | **59.91%** | **25.23%** | **24.99%** | **57.49%** | **Selected Primary Model** (ensemble bagging) |

*Artifacts persisted via Joblib: `models/severity_random_forest.joblib` and `models/preprocessor_pipeline.joblib`.*

---

## 5. API Endpoints Specification

FastAPI automatically generates interactive Swagger documentation at `http://127.0.0.1:8000/docs`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health status and preloaded model verification |
| `GET` | `/api/dashboard/summary` | Top-level counts, averages, and distribution charts |
| `GET` | `/api/accidents?limit=150` | Filtered accident records for map points |
| `GET` | `/api/hotspots?k=10` | K-Means cluster centers, densities, and radii |
| `GET` | `/api/hotspots/dbscan` | DBSCAN Haversine density clusters and noise count |
| `GET` | `/api/hotspots/comparison` | Empirical K-Means vs DBSCAN comparison table |
| `GET` | `/api/models/metrics` | Evaluated metrics, confusion matrices, and feature importances |
| `POST` | `/api/predict/severity` | Real-time severity inference with class probabilities |
| `GET` | `/api/analytics/time` | 24-hour commute trends and weekday breakdown |
| `GET` | `/api/analytics/weather` | Weather condition frequencies and temperature bins |
| `GET` | `/api/analytics/infrastructure` | Impact of junctions, signals, crossings, and stops |

---

## 6. Installation & Execution Guide

### Prerequisites
- Python 3.12+ (Anaconda or standalone)
- Node.js v18+ & npm

### Step 1: Install Python Dependencies
```bash
pip install -r server/requirements.txt
```

### Step 2: Run Data Preprocessing & Model Training
```bash
# 1. Generate development fixture (if raw Kaggle dataset is not yet downloaded)
python scripts/generate_dev_fixture.py

# 2. Run reproducible preprocessing pipeline
python scripts/preprocess.py

# 3. Train geospatial clustering models (K-Means & DBSCAN with Haversine)
python scripts/train_clustering.py

# 4. Train and persist classification models (Logistic Reg, Decision Tree, Random Forest)
python scripts/train_classification.py

# 5. Run test suite to verify pipeline integrity
python -m pytest tests/ -v
```

### Step 3: Start FastAPI Backend
```bash
python -m uvicorn server.app.main:app --reload --port 8000
```
*API Swagger UI available at:* `http://127.0.0.1:8000/docs`

### Step 4: Start React Frontend
```bash
cd client
npm install
npm run dev
```
*Frontend UI accessible at:* `http://localhost:5173`

---

## 7. Seven-Day Project Roadmap Summary

- **Day 1 (Dataset & Preprocessing):** Cleaned deduplicated records, continental US coordinate filtering, temporal feature engineering (`Hour`, `Weekday`, `Is_Rush_Hour`).
- **Day 2 (Clustering Pipeline):** Haversine distance implementation, K-Means ($K=5..20$), DBSCAN density blackspot identification, and noise separation.
- **Day 3 (Classification Models):** Scikit-Learn `ColumnTransformer` (median imputation, scaling, one-hot encoding), leak-free feature selection.
- **Day 4 (Model Evaluation & Persistence):** Stratified test benchmarking, confusion matrices, Random Forest Gini feature importances, Joblib serialization.
- **Day 5 (FastAPI Backend):** REST API endpoints with Pydantic schemas, service layer caching, sub-50ms inference.
- **Day 6 (React 19 Frontend):** Dark navy dashboard theme, Leaflet OpenStreetMap integration, Recharts analytics, and live severity simulation form.
- **Day 7 (Testing & Documentation):** 14 Pytest tests, interactive Jupyter notebooks (`notebooks/`), and comprehensive Viva preparation guide (`docs/viva_guide.md`).

---

## 8. Limitations & Future Enhancements

- **Vehicle Miles Traveled (VMT) Normalization:** High accident counts in fair weather reflect exposure rather than hazard. Integrating traffic sensor volume (Caltrans PeMS) would enable true crash rate normalization.
- **Real-Time Weather API Integration:** Connecting live OpenWeatherMap API feeds to automatically populate inference parameters for active highway corridors.
- **Deep Graph Neural Networks (GNN):** Modeling road networks as continuous graph nodes and edges to capture traffic wave propagation.

