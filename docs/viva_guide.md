# Academic Viva & Examination Guide
## Accident Hotspot Prediction and Road Safety Intelligence System

This document is specifically tailored for a **B.Tech Computer Science & Engineering** student defending this project in an ML lab, capstone review, or technical interview.

---

### 1. Project Overview & Core Objectives

**Q1: What is the primary problem your project solves?**  
**Answer:**  
"Our project builds an intelligent geospatial and predictive road safety platform. It addresses two distinct machine learning challenges:
1. **Spatial Hotspot Identification:** Automatically discovering recurring high-density accident blackspots along highway corridors using unsupervised clustering (comparing K-Means and Haversine DBSCAN).
2. **Accident Severity Classification:** Estimating the traffic delay impact level (Severity 1 to 4) of an incident based strictly on pre-existing environmental, temporal, and road infrastructure factors, using leak-free supervised machine learning."

**Q2: What dataset did you use and what does the 'Severity' attribute represent?**  
**Answer:**  
"We utilized the nationwide **US Accidents (2016–2023)** dataset authored by Dr. Sobhan Moosavi.  
**Critical Note:** The dataset's `Severity` metric (scale 1 to 4) represents the **traffic delay impact** (duration of traffic slowdown and congestion), **not human injury or fatality severity**. For instance, Severity 1 indicates negligible commute disruption (<15 minutes), whereas Severity 4 indicates a major prolonged roadway closure (>90 minutes)."

---

### 2. Spatial Clustering: K-Means vs. DBSCAN with Haversine Metric

**Q3: Why can't we simply use standard Euclidean distance $( \sqrt{\Delta x^2 + \Delta y^2} )$ for latitude and longitude?**  
**Answer:**  
"Latitude and longitude are spherical angular coordinates measured in degrees, not points on a flat Cartesian plane. Because the Earth is roughly an oblate spheroid ($R \approx 6,371$ km):
- One degree of latitude is approximately constant (~111 km).
- One degree of longitude shrinks dramatically as you move away from the equator: $\Delta \text{distance} \approx 111 \times \cos(\text{latitude})$.
Applying flat Euclidean distance creates severe geometric distortion, especially at higher latitudes. Therefore, we implement the **Haversine great-circle distance formula**:
$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
In Scikit-Learn's `DBSCAN(metric='haversine')`, all coordinates must be converted to **radians**, and the neighborhood radius $\epsilon$ must be passed in radians:
$$\epsilon_{\text{radians}} = \frac{\epsilon_{\text{km}}}{R_{\text{Earth}}}$$"

**Q4: How do K-Means and DBSCAN compare in spatial hotspot detection?**  
**Answer:**  

| Dimension | K-Means Clustering | DBSCAN (Density-Based) |
| :--- | :--- | :--- |
| **Cluster Geometry** | Convex, spherical Voronoi partitions around geometric centroids | Arbitrary non-linear shapes following curvy freeways and highway junctions |
| **Number of Clusters** | Requires pre-specifying $K$ (e.g., tested $K=5, 8, 10, 15, 20$) | Discovers natural density clusters automatically via $\epsilon$ and $\text{MinPts}$ |
| **Outlier Handling** | Forces all remote rural incidents into the nearest cluster center | Explicitly isolates low-density rural accidents as noise ($\text{label} = -1$) |
| **Distance Metric** | Euclidean approximation | True Great-Circle Haversine spherical metric |
| **Practical Use-Case** | Partitioning administrative patrol and emergency service zones | Identifying high-density freeway blackspots for structural safety intervention |

---

### 3. Classification Pipeline & Zero Data Leakage

**Q5: What is Data Leakage, and how did your pipeline prevent it?**  
**Answer:**  
"Data leakage occurs when information from outside the training partition or outcome indicators that would not be available at the time of prediction are included in the feature set.  
In this dataset, features like:
- `End_Time`
- `Duration_Minutes` (calculated as `End_Time - Start_Time`)
- `Distance(mi)` (the length of the road affected by the accident)
- `Description` (which often explicitly writes 'severe delay' or 'freeway closed')  
directly reveal the traffic delay outcome. Including them would yield artificially inflated (near-100%) accuracy that collapses in real-world deployment.  
We strictly excluded all post-incident indicators and restricted the model to pre-incident features: ambient temperature, humidity, visibility, wind speed, weather condition, hour of day, day of week, rush-hour status, and road infrastructure flags (junction, crossing, traffic signal, stop sign)."

**Q6: What preprocessing steps did you implement?**  
**Answer:**  
"We constructed a reproducible Scikit-Learn `ColumnTransformer` pipeline:
1. **Numerical Pipeline:** Median imputation (robust to extreme weather spikes) followed by `StandardScaler` to ensure zero mean and unit variance.
2. **Categorical Pipeline:** Constant imputation (`Unknown`) followed by `OneHotEncoder(handle_unknown='ignore')` to encode weather conditions and weekdays without imposing false ordinal hierarchies.
3. **Boolean Pipeline:** Constant imputation to `False` followed by float conversion.
4. **Stratified Split:** An 80/20 train/test split with `stratify=y` to preserve the exact class proportions across partitions."

---

### 4. Class Imbalance & Evaluation Metrics

**Q7: Why is Accuracy an insufficient metric for this dataset?**  
**Answer:**  
"The dataset exhibits severe class imbalance:
- Severity 1: ~2.8%
- **Severity 2: ~71.8%** (dominant traffic delay class)
- Severity 3: ~18.2%
- Severity 4: ~7.2%

If a dummy model simply predicted 'Severity 2' for every incident, it would achieve ~72% accuracy while having a 0% recall on severe, prolonged road closures (Severities 3 & 4).  
Therefore, we evaluated our models using:
- **Macro F1-Score:** The unweighted arithmetic mean of F1 scores across all four classes, treating minority severe classes with equal importance.
- **Balanced Accuracy:** The average recall across all individual classes.
- **Confusion Matrix Heatmaps:** Visually validating that the diagonal contains accurate true positives and off-diagonals are minimized.
- **Class Weight Balancing (`class_weight='balanced'`):** Penalizes misclassifications on minority classes inversely proportional to class frequencies."

**Q8: Why did Random Forest outperform Logistic Regression and Decision Trees?**  
**Answer:**  
"1. **Non-Linear Feature Interactions:** Weather and road infrastructure have non-linear joint effects (e.g., rain combined with a highway junction at evening rush hour creates a compounded delay multiplier that a linear hyperplane in Logistic Regression cannot easily capture).  
2. **Variance Reduction:** While a single Decision Tree overfits to noise in the weather records, Random Forest ensembles 100 decorrelated trees via bootstrap aggregation (bagging) and random feature subspace sampling, significantly improving generalization."

---

### 5. Architectural & Full-Stack Implementation

**Q9: How is the application structured and decoupled?**  
**Answer:**  
- **Frontend:** Built with React 19, TypeScript, and Vite, styled with Tailwind CSS. Maps are rendered dynamically using React Leaflet and OpenStreetMap tiles. Analytics use Recharts.
- **Backend:** High-performance Python FastAPI service with Pydantic request/response validation schemas. Business logic and data caching are decoupled into dedicated service classes (`DataService`, `HotspotService`, `PredictionService`).
- **Persistence:** Models and preprocessor pipelines are serialized via Joblib, loading once into memory at application startup to guarantee sub-50ms inference times.

