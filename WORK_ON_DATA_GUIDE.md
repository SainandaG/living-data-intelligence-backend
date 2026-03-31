# 🧪 Work on Data: Analytical Intelligence Guide

## 1. Overview
The **"Work on Data"** feature is the platform's advanced analytical engine. It transcends simple visualization by allowing users to apply real Machine Learning algorithms to their database tables in real-time. Whether you are seeking to predict future trends, classify customer segments, or discover hidden clusters, the platform provides a seamless bridge between raw data and predictive intelligence.

---

## 2. Core Intelligent Workflows

### 2.1 AI-Powered Suggestion Engine
Upon opening the "Work on Data" interface, the platform immediately performs a heuristic analysis of your schema.
- **Logic**: It identifies date-times for time series, numeric columns for regression, and categorical fields for classification.
- **Outcome**: A "Smart Recommendation" banner appears, suggesting the most statistically relevant table and algorithm family, along with a confidence score.

### 2.2 Algorithm Catalogue
The platform supports four primary analytical families, each backed by industry-standard `scikit-learn` implementations:

| Family | Icon | Primary Use Case | Supported Algorithms |
| :--- | :--- | :--- | :--- |
| **Classification** | 🌿 | Predicting discrete labels or categories. | Random Forest, SVM, KNN, Logistic Regression |
| **Regression** | 📈 | Predicting continuous numeric values. | XGBoost, Linear, Ridge, Lasso Regression |
| **Time Series** | 🕒 | Forecasting temporal patterns and trends. | ARIMA, Prophet, Harmonic Regression |
| **Clustering** | 🗂️ | Discovering natural groupings (unsupervised). | K-Means, DBSCAN |

---

## 3. Deep Analysis Interface (`/deep-analysis`)
For intensive research, users can transition from the configuration modal to the **Full-Screen Deep Analysis Page**. This environment is designed for "Streamlit-like" interactive exploration.

### 3.1 Advanced Visualizations
- **2D Scatter Plot**: Colored by cluster/class with multi-axis mapping.
- **Feature Importance**: Dynamic bar charts showing which columns drive the model's decisions.
- **Trend & Forecast**: Composed charts showing actual vs. predicted values with 95% Confidence Intervals.
- **3D Spatial Plot**: A WebGL-powered 3D point cloud for multi-dimensional relationship discovery.
- **Correlation Heatmap**: A matrix visualization of inter-feature relationships (Cyan = Positive, Purple = Negative).

### 3.2 AI Analyst Chat
Integrated at the bottom-right of the Deep Analysis page is a persistent **AI Analyst Chat**.
- **Context Awareness**: The AI "sees" the model results (metrics, importance, predictions).
- **Inquiry**: Users can ask: *"What are the primary drivers for this target?"* or *"Explain why the ARIMA model shows a dip next week."*
- **Explainable AI**: The chat generates natural language explanations for statistical patterns.

---

## 4. Technical Architecture

### 4.1 Backend: ML Analysis Engine (`ml_analysis.py`)
The backend provides a vectorized pipeline for non-blocking analysis:
1.  **Ingestion**: Fetches up to 5,000 rows from the target table.
2.  **Preprocessing**: 
    -   Missing value imputation (Median/Mode).
    -   Categorical encoding (LabelEncoding).
    -   Feature scaling (StandardScaler for SVM/KNN).
3.  **Execution**: Runs the algorithm in a separate thread (via `run_in_executor`) to avoid blocking the FastAPI event loop.
4.  **Serialization**: Returns a structured JSON containing metrics (R², Precision, etc.), feature importance arrays, and extrapolated prediction points.

### 4.2 API Specification
- `POST /api/ml/analyze`: The core execution endpoint.
- `POST /api/ml/suggest`: Heuristic recommender based on schema metadata.
- `GET /api/data/sample/{table}`: Fetches raw records for the scatter/3D plots.

---

## 5. Deployment & Performance
- **Read-Only**: The ML engine never writes back to the database, ensuring zero footprint on production performance.
- **Memory Efficient**: Uses `pandas` for processing, with automatic row capping to prevent OOM (Out Of Memory) issues on massive tables.
- **Exportable**: Resulting models and summaries can be exported as JSON reports for external validation.
