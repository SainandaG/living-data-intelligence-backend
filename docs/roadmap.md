# Project Roadmap

The Living Data Intelligence Platform is continuously evolving. Below is our roadmap detailing the journey from initial prototype to enterprise-ready production release.

## Phase 1: Foundation (Completed)
- ✅ 3D Database Schema Visualization
- ✅ Basic AI Natural Language Chat
- ✅ Dual Clustering (Heuristic and NetworkX)
- ✅ FastAPI & React Boilerplates

## Phase 2: Advanced Intelligence (Current)
- 🚀 **Work on Data (ML Subsystem)**: Introduce Classification, Regression, and Time Series Forecasting.
- 🚀 **Explainable AI**: Integrate SHAP to explain model predictions.
- 🚀 **Asynchronous Architecture**: Background job processing for large-scale datasets.

## Phase 3: Production Readiness & Hardening (Short-term)
- 🔒 **Secret Management**: Transition all DB and AI keys to secure environment variables.
- 🔒 **Authentication**: Implementation of full JWT-based authentication layer and RBAC (Role-Based Access Control).
- 🛡️ **Service Hardening**: Implement SQL injection protection for all AI-to-SQL conduit services.

## Phase 4: Enterprise Scale (Mid-term)
- 🌍 **Distributed Tracing**: Full OpenTelemetry integration for tracing data flows across microservices.
- ☁️ **Cloud Native Deployments**: Official Kubernetes Helm charts and Terraform provisioning scripts.
- 🤝 **Collaborative Workspaces**: Multiplayer 3D environments where teams can explore database schemas together in real-time.

## Phase 5: Ecosystem Expansion (Long-term)
- 🔌 **Plugin Architecture**: Allow the community to build custom visualizers and ML predictors.
- 📊 **Streaming Data Integrations**: Native support for Kafka, Kinesis, and RabbitMQ visualizations.
