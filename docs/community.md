# Community & API Guidelines

The Living Data Intelligence Platform thrives on open-source contributions. This document outlines how the community can use the platform, contribute, and understand the core inputs and outputs of the system.

## How the Community Can Use It

- **Educators & Students**: Use the 3D visualization to teach relational database design and SQL architecture.
- **Data Engineers**: Quickly onboard new team members by visualizing legacy databases instead of reading outdated ER diagrams.
- **Data Scientists**: Leverage the "Work on Data" APIs to rapidly test ML models (Classification, Regression) against raw database tables.

## Core API Inputs & Outputs

To effectively use or extend the platform, you must understand the core data structures.

### 1. Schema Optimization API

**Endpoint**: `POST /api/optimize`

**Input**:
```json
{
  "connection_id": "uuid-string",
  "active": true,
  "method": "networkx" // or "heuristic"
}
```

**Output**:
```json
{
  "status": "success",
  "clusters": {
    "auth_cluster": ["users", "roles", "permissions"],
    "transaction_cluster": ["orders", "payments", "invoices"]
  },
  "metrics": {
    "modularity": 0.85,
    "execution_time_ms": 45
  }
}
```

### 2. Work on Data ML API

**Endpoint**: `POST /api/ml/analyze`

**Input**:
```json
{
  "table_name": "customer_churn",
  "target_column": "churned",
  "task_type": "classification",
  "features": ["age", "tenure", "monthly_charges"]
}
```

**Output**:
```json
{
  "model_accuracy": 0.92,
  "shap_values": {
    "tenure": 0.45,
    "monthly_charges": 0.30,
    "age": 0.15
  },
  "insights": "The model indicates that shorter 'tenure' combined with higher 'monthly_charges' are the strongest predictors of customer churn."
}
```

## Contributing Guidelines

1. **Fork and Clone**: Fork the repository and create your feature branch.
2. **Setup Dev Environment**: Use `docker-compose.yml` for isolated testing.
3. **Write Tests**: Ensure any new ML features or endpoints include Pytest coverage.
4. **Submit PR**: Provide a detailed description of "What input is given, what output is given" for any new features.
