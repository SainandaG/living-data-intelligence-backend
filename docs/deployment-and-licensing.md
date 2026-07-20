# Deployment, Hosting & Licensing Guide

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Hosting Options](#hosting-options)
3. [Cost Estimates](#cost-estimates)
4. [Licenses & Compliance](#licenses--compliance)
5. [API Service Costs](#api-service-costs)
6. [Project Plans & Roadmap](#project-plans--roadmap)

---

## System Requirements

### Backend (FastAPI + ML Stack)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 10 GB | 20 GB |
| Python | 3.11+ | 3.12 |
| Redis | 7.x | 7.x (Alpine) |

> **Note:** PyTorch (2 GB) and TensorFlow (500 MB) are the heaviest dependencies. Instances with less than 4 GB RAM will fail during model training.

### Frontend (React + Vite)

| Resource | Minimum |
|----------|---------|
| Build output | ~5 MB static files |
| Node.js (build only) | 18+ |
| Hosting | Any static file host / CDN |

### Database

The platform connects to the **user's existing database**. Supported engines:
- PostgreSQL (primary, via `asyncpg`)
- MySQL (via `aiomysql`)
- MongoDB (via `motor`)
- File uploads: CSV, Excel, ODS (via `duckdb` + `pandas`)

No database hosting is required from the platform side.

---

## Hosting Options

### Frontend Platforms

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Vercel** | 100 GB bandwidth/mo | $20/mo (Pro) | React/Vite apps, GitHub auto-deploy |
| **Netlify** | 100 GB bandwidth/mo | $19/mo (Pro) | Static sites, form handling |
| **Cloudflare Pages** | Unlimited bandwidth | $5/mo (Workers) | Global CDN, fastest edge delivery |
| **AWS S3 + CloudFront** | 1 GB free (12 months) | ~$1-5/mo | Cheapest at scale |
| **Azure Static Web Apps** | 100 GB bandwidth/mo | $9/mo (Standard) | Azure ecosystem integration |
| **Firebase Hosting** | 10 GB/mo | $0.026/GB | Google ecosystem integration |

### Backend Platforms

| Platform | Specs | Monthly Cost | Best For |
|----------|-------|-------------|----------|
| **Railway** | 8 GB RAM, shared CPU | $5-20 | Easiest Docker deploy, built-in Redis |
| **Render** | 2 GB RAM (free), 4 GB ($25) | $0-25 | Simple setup, managed services |
| **AWS EC2 t3.medium** | 4 GB RAM, 2 vCPU | $30-35 | Production ML workloads |
| **AWS EC2 t3.large** | 8 GB RAM, 2 vCPU | $60-65 | Comfortable for all ML operations |
| **Google Cloud Run** | Auto-scaling | $0-50 (pay-per-request) | Variable traffic, but cold starts hurt ML |
| **DigitalOcean Droplet** | 4 GB RAM, 2 vCPU | $24 | Budget-friendly VPS |
| **Azure App Service B2** | 3.5 GB RAM, 2 vCPU | $55 | Enterprise / Azure shops |
| **Fly.io** | 1-8 GB RAM | $5-30 | Edge deployment, WebSocket support |
| **Self-hosted VPS** (Hetzner, OVH) | 8 GB RAM, 4 vCPU | $10-20 | Maximum control, lowest cost |

### GPU Hosting (Optional — for heavy ML inference)

| Platform | GPU | Monthly Cost |
|----------|-----|-------------|
| **AWS g4dn.xlarge** | NVIDIA T4 (16 GB) | $150-380 |
| **Lambda Labs** | NVIDIA A10 (24 GB) | $200-350 |
| **Google Cloud A2** | NVIDIA A100 (40 GB) | $800+ |
| **Vast.ai** | Various | $50-150 (spot) |

> GPU hosting is only needed if you run real-time PyTorch/TensorFlow inference at scale. For small-scale use, CPU instances are sufficient.

### Redis Hosting

| Platform | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Railway add-on** | Included in plan | — | Simplest if backend is on Railway |
| **Upstash** | 10K commands/day | $0.2/100K cmd | Serverless, good for low traffic |
| **AWS ElastiCache** | — | $13+/mo | Production-grade |
| **Redis Cloud** | 30 MB | $5+/mo | Managed by Redis Inc. |

### Deployment Architecture

The project includes ready-to-use Docker configurations:

```
docker-compose.yml              → Development (HTTP)
docker-compose.production.yml   → Production (HTTPS + Let's Encrypt + Certbot auto-renewal)
backend/Dockerfile              → Backend container
frontend/Dockerfile             → Frontend container (Nginx)
```

Production deploy command:
```bash
docker compose -f docker-compose.production.yml up -d
```

---

## Cost Estimates

### Scenario 1: Demo / Portfolio

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Vercel / Cloudflare Pages (free) | $0/mo |
| Backend | Railway Hobby | $5-15/mo |
| Redis | Railway (included) | $0/mo |
| Domain | Cloudflare Registrar | ~$10/yr |
| SSL | Let's Encrypt | $0 |
| API keys | Gemini/Groq free tier | $0/mo |
| **Total** | | **$5-15/mo** |

### Scenario 2: Small Production (1-50 users)

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Vercel Pro | $20/mo |
| Backend | AWS EC2 t3.medium or Railway Pro | $30-40/mo |
| Redis | Upstash or Railway | $0-10/mo |
| Domain + DNS | Cloudflare | ~$10/yr |
| SSL | Let's Encrypt | $0 |
| API keys | Gemini/Groq paid | $5-15/mo |
| Monitoring | Better Stack / Uptime Robot | $0-10/mo |
| **Total** | | **$55-95/mo** |

### Scenario 3: Production (50-500 users)

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | Cloudflare Pages + Workers | $5-25/mo |
| Backend | AWS EC2 t3.large (or 2× t3.medium) | $60-130/mo |
| Redis | AWS ElastiCache | $15-30/mo |
| Domain + DNS + WAF | Cloudflare Pro | $20/mo |
| SSL | Let's Encrypt | $0 |
| API keys | Gemini/Groq paid | $20-50/mo |
| Monitoring + Logging | Datadog / Grafana Cloud | $0-25/mo |
| **Total** | | **$120-280/mo** |

### Scenario 4: Enterprise with GPU

| Component | Platform | Cost |
|-----------|----------|------|
| Frontend | CDN (CloudFront / Cloudflare) | $20-50/mo |
| Backend (API) | AWS ECS / Kubernetes | $100-200/mo |
| Backend (ML Worker) | AWS g4dn.xlarge (GPU) | $150-380/mo |
| Redis | AWS ElastiCache | $30/mo |
| Load Balancer | AWS ALB | $20/mo |
| Domain + SSL + WAF | Cloudflare Business | $200/mo |
| API keys | Gemini/Groq | $50-200/mo |
| Monitoring | Datadog | $25-100/mo |
| **Total** | | **$595-1,180/mo** |

---

## Licenses & Compliance

### Software License (Your Project)

No license file is currently present in the repository. Choose one based on your distribution model:

| License | Type | When to Use |
|---------|------|-------------|
| **MIT** | Permissive open source | Anyone can use, modify, and sell. Maximum adoption |
| **Apache 2.0** | Permissive + patent grant | Open source with patent protection for contributors |
| **BSL 1.1** (Business Source License) | Source-available | Code is visible but commercial use restricted for N years. Used by Sentry, CockroachDB, HashiCorp |
| **AGPL 3.0** | Copyleft | Users must open-source modifications, even for SaaS usage |
| **Proprietary** | Closed source | Full commercial control, no code sharing |

> **Recommendation for SaaS:** BSL 1.1 or Apache 2.0. BSL protects against competitors reselling your product while keeping the code visible for trust and contributions.

### Dependency Licenses (All Free)

All dependencies used in this project are under permissive open-source licenses:

#### Backend Dependencies

| Package | License | Cost | Obligation |
|---------|---------|------|------------|
| FastAPI | MIT | Free | Include license notice |
| Uvicorn | BSD-3 | Free | Include license notice |
| Pydantic | MIT | Free | Include license notice |
| SQLAlchemy | MIT | Free | Include license notice |
| PyTorch | BSD-3 | Free | Include license notice |
| TensorFlow | Apache 2.0 | Free | Include license + patent notice |
| scikit-learn | BSD-3 | Free | Include license notice |
| NumPy / Pandas | BSD-3 | Free | Include license notice |
| SHAP | MIT | Free | Include license notice |
| MLflow | Apache 2.0 | Free | Include license notice |
| NetworkX | BSD-3 | Free | Include license notice |
| DuckDB | MIT | Free | Include license notice |
| Redis (client) | MIT | Free | Include license notice |
| Optuna | MIT | Free | Include license notice |
| ReportLab | BSD | Free | Include license notice |
| Alembic | MIT | Free | Include license notice |
| python-jose | MIT | Free | Include license notice |
| passlib | BSD | Free | Include license notice |

#### Frontend Dependencies

| Package | License | Cost | Obligation |
|---------|---------|------|------------|
| React | MIT | Free | Include license notice |
| Three.js | MIT | Free | Include license notice |
| D3.js | ISC | Free | Include license notice |
| React Three Fiber | MIT | Free | Include license notice |
| Zustand | MIT | Free | Include license notice |
| Recharts | MIT | Free | Include license notice |
| Framer Motion | MIT | Free | Include license notice |
| Tailwind CSS | MIT | Free | Include license notice |
| Axios | MIT | Free | Include license notice |
| Lucide React | ISC | Free | Include license notice |
| SheetJS (xlsx) | Apache 2.0 | Free | See note below |
| React Router | MIT | Free | Include license notice |

> **SheetJS Note:** The open-source `xlsx` package (Apache 2.0) is free. However, the **SheetJS Pro** version — which adds streaming writes, styling, and advanced features — requires a **commercial license (~$500/year)**. If you only use basic read/write operations, the free version is sufficient.

### License Compliance Checklist

- [ ] Add a `LICENSE` file to the repository root
- [ ] Create a `THIRD_PARTY_NOTICES` file listing all dependency licenses
- [ ] Include attribution in the application's About/Settings page
- [ ] If using Apache 2.0 deps: include NOTICE files from those projects
- [ ] Review SheetJS usage — ensure no Pro-only features are used without a license
- [ ] Review Google Gemini and Groq API Terms of Service for your use case

### Licenses NOT Required

| Item | Why |
|------|-----|
| Redis server | BSD-3 — free for any use |
| Nginx | BSD-2 — free for any use |
| Docker | Apache 2.0 — free (Docker Desktop requires a paid subscription for companies with 250+ employees or $10M+ revenue) |
| Let's Encrypt SSL | Free, automated certificates |
| Certbot | Apache 2.0 — free |
| PostgreSQL / MySQL | PostgreSQL License / GPL — free |

---

## API Service Costs

These are external services your backend calls. Costs depend on usage volume.

### Google Gemini API (`google-genai`)

| Tier | Rate Limit | Cost |
|------|-----------|------|
| Free | 15 requests/min, 1M tokens/day | $0 |
| Pay-as-you-go (Flash) | 1,000 RPM | ~$0.075/1M input tokens |
| Pay-as-you-go (Pro) | 1,000 RPM | ~$1.25/1M input tokens |

Estimated monthly cost: **$0-10** for light use (< 100 queries/day)

### Groq API

| Tier | Rate Limit | Cost |
|------|-----------|------|
| Free | 30 requests/min | $0 |
| Pay-as-you-go | Higher limits | ~$0.05-0.27/1M tokens |

Estimated monthly cost: **$0-5** for light use

### Total API Budget

| Usage Level | Monthly API Cost |
|-------------|-----------------|
| Development / Demo | $0 (free tiers) |
| Light production (< 1K queries/day) | $5-15 |
| Medium production (1K-10K queries/day) | $15-80 |
| Heavy production (10K+ queries/day) | $80-500+ |

---

## Project Plans & Roadmap

### Plan 1: Production Grade Hardening (Do First)

**Goal:** Make existing features production-ready. No new features — only bug fixes, tests, and reliability improvements.

**Timeline:** 8-12 days

| Track | Focus | Duration | Key Deliverables |
|-------|-------|----------|------------------|
| Track 1 | Backend Cleanliness | 1-2 days | Remove dead params, fix algo validation, add 120s timeout, proper error codes |
| Track 2 | Test Coverage | 2-3 days | Edge case tests for all 4 ML families, experiment tracker concurrency tests |
| Track 3 | Frontend Reliability | 2-3 days | Replace fake progress with real polling, add job cancellation, structured error display |
| Track 4 | API Completeness | 1-2 days | Add `/run/{id}/status` and `DELETE /run/{id}` endpoints, fix GET/POST mismatch |
| Track 5 | Ops Hardening | 1-2 days | Startup validation, request size limits, concurrent read safety, `/ml/health` endpoint |

**Definition of Done:**
- All existing tests pass + new edge case tests
- No fake progress bars in the frontend
- All 4 algorithm families display correct metrics
- ML runs have a 120s timeout
- Health endpoint returns operational status

### Plan 2: Palantir-Grade Expansion (Do Second)

**Goal:** Upgrade the ML module to enterprise-grade with explainability, model management, drift detection, and a redesigned UI.

**Timeline:** 12 weeks (10 phases)

| Phase | Feature | Timeline | New Components |
|-------|---------|----------|----------------|
| 1 | Data Validation & Feature Engineering | Weeks 1-2 | `DataValidator`, `FeatureEngineer`, `DataQualityPanel` |
| 2 | Cross-Validation & Honest Metrics | Weeks 2-3 | `MetricCard`, `LearningCurve` |
| 3 | Hyperparameter Tuning UI + Live Stream | Weeks 3-4 | `TuningPanel`, SSE streaming |
| 4 | SHAP Explainability Suite | Weeks 4-5 | `ExplainabilityPanel`, `ShapWaterfall`, `PDPChart`, `CounterfactualPanel` |
| 5 | Model Registry & Artifact Store | Weeks 5-6 | `ModelRegistry`, leaderboard, promote/compare |
| 6 | Drift Detection & Monitoring | Weeks 6-7 | `DriftMonitor`, `DriftDashboard` |
| 7 | Full UI Redesign | Weeks 7-9 | 22 new components, 3-panel layout |
| 8 | Investigation Workspace V2 | Weeks 9-10 | Export to PDF/Markdown/Notebook, version history |
| 9 | APEX Agent V2 | Weeks 10-11 | Multi-turn context, semantic memory, cost tracking |
| 10 | Rate Limiting & Observability | Weeks 11-12 | Per-tenant budgets, structured logging for ELK/Datadog |

**New Algorithms Added:**
- Classification: Gradient Boosting Ensemble (RF+XGB voting)
- Regression: ElasticNet (L1+L2 hybrid)
- Clustering: HDBSCAN, Gaussian Mixture Model
- Time Series: SARIMA

---

## Quick-Start Cost Summary

| Scenario | Hosting | Licenses | APIs | Total |
|----------|---------|----------|------|-------|
| **Demo / Portfolio** | $5-15/mo | $0 | $0 | **$5-15/mo** |
| **Small Production** | $55-95/mo | $0 | $5-15/mo | **$60-110/mo** |
| **Medium Production** | $120-280/mo | $0 | $15-80/mo | **$135-360/mo** |
| **Enterprise + GPU** | $595-1,180/mo | $0 | $50-200/mo | **$645-1,380/mo** |

> All software dependencies are free and open-source. The only recurring costs are compute (hosting) and API usage (Gemini/Groq).

---

## User Capacity & Initial Expectations

### How Many Users Can the Platform Handle?

| Infrastructure | Concurrent Users | Monthly Active Users | Bottleneck |
|----------------|-----------------|---------------------|------------|
| Railway Hobby (2 GB) | 5-10 | 20-50 | RAM for ML jobs |
| EC2 t3.medium (4 GB) | 15-30 | 50-200 | ML model training queues |
| EC2 t3.large (8 GB) | 30-60 | 200-500 | API concurrency |
| 2× EC2 + Load Balancer | 60-150 | 500-2,000 | DB connections |
| Kubernetes cluster | 150-500+ | 2,000-10,000+ | Scaling budget |

> **Key constraint:** Each ML training job (Work on Data) uses ~1-2 GB RAM for 10-60 seconds. A 4 GB server can run ~2 ML jobs simultaneously. Queue or reject the rest.

### Initial Launch Target

For a new SaaS launch, a realistic ramp:

| Period | Expected Users | Revenue Target | Infrastructure |
|--------|---------------|----------------|----------------|
| Month 1-3 (Beta) | 10-50 free users | $0 (validation) | Railway ($15/mo) |
| Month 4-6 (Early Access) | 50-200 users | $500-2,000/mo | EC2 t3.medium ($40/mo) |
| Month 7-12 (Growth) | 200-1,000 users | $3,000-15,000/mo | EC2 t3.large + Redis ($80/mo) |
| Year 2 (Scale) | 1,000-5,000 users | $15,000-75,000/mo | Multi-instance + GPU ($300-600/mo) |

---

## Pricing Plans

### Plan Structure

| Plan | Price | Target User | Key Limits |
|------|-------|-------------|------------|
| **Free** | $0/mo | Students, hobbyists, evaluators | 1 database connection, 5 ML runs/day, 3 tables max, community support |
| **Starter** | $19/mo per user | Freelancers, small teams | 3 connections, 50 ML runs/day, unlimited tables, email support |
| **Professional** | $49/mo per user | Data teams, analysts | 10 connections, unlimited ML runs, SHAP explainability, model registry, priority support |
| **Enterprise** | $149/mo per user (or custom) | Large orgs, compliance-heavy | Unlimited connections, GPU inference, drift monitoring, SSO/SAML, SLA, dedicated support |

### What Each Plan Includes

#### Free
- Database schema visualization (3D graph)
- Multi-table inspector (up to 3 tables)
- Basic ML analysis (classification, regression)
- 5 ML runs per day
- 1 database connection
- Community support (GitHub Issues)

#### Starter ($19/mo)
- Everything in Free
- Unlimited tables
- 50 ML runs per day
- 3 database connections
- Clustering + Time Series analysis
- AutoML (basic hyperparameter tuning)
- Experiment history (30 days)
- Email support

#### Professional ($49/mo)
- Everything in Starter
- Unlimited ML runs
- 10 database connections
- SHAP explainability suite (waterfall, PDP, counterfactual)
- Model registry & artifact store
- Cross-validation with confidence intervals
- Export reports (PDF, Markdown)
- APEX AI Agent (investigation assistant)
- Priority support (24h response)

#### Enterprise ($149/mo or custom)
- Everything in Professional
- Unlimited database connections
- GPU-accelerated inference
- Drift detection & monitoring
- Custom model deployment
- SSO / SAML authentication
- Role-based access control
- Dedicated account manager
- SLA (99.9% uptime guarantee)
- On-premise deployment option
- Custom integrations (MCP, CrewAI)

### Add-Ons (Any Plan)

| Add-On | Price | Description |
|--------|-------|-------------|
| Extra DB connections | $5/mo each | Beyond plan limit |
| GPU inference | $29/mo | Dedicated GPU for ML training |
| Extended history | $9/mo | 1 year experiment history (vs 30 days) |
| White-label | $99/mo | Remove branding, custom domain |

---

## Revenue Projections

### Conservative Estimate (Year 1)

Assumes 60% Free, 25% Starter, 12% Professional, 3% Enterprise.

| Month | Total Users | Paying Users | MRR (Monthly Recurring Revenue) |
|-------|-------------|-------------|--------------------------------|
| 3 | 50 | 8 | $300 |
| 6 | 200 | 40 | $1,400 |
| 9 | 500 | 100 | $3,800 |
| 12 | 1,000 | 200 | $7,900 |
| **Year 1 Total** | | | **~$40,000 ARR** |

### Moderate Estimate (Year 1)

Assumes stronger conversion: 50% Free, 28% Starter, 15% Professional, 7% Enterprise.

| Month | Total Users | Paying Users | MRR |
|-------|-------------|-------------|-----|
| 3 | 80 | 16 | $620 |
| 6 | 350 | 88 | $3,600 |
| 9 | 800 | 200 | $8,500 |
| 12 | 1,500 | 400 | $17,200 |
| **Year 1 Total** | | | **~$90,000 ARR** |

### Revenue vs Cost (Break-Even Analysis)

| Stage | Monthly Revenue | Monthly Cost | Profit |
|-------|----------------|-------------|--------|
| Beta (Month 1-3) | $0-300 | $15-40 | -$40 to +$260 |
| Early Access (Month 4-6) | $1,000-3,600 | $40-80 | +$920 to +$3,520 |
| Growth (Month 7-12) | $3,800-17,200 | $80-200 | +$3,600 to +$17,000 |
| Scale (Year 2) | $15,000-75,000 | $300-1,200 | +$13,800 to +$73,800 |

> **Break-even point:** ~Month 2-3 with even a handful of paying users. Infrastructure costs are low ($15-80/mo) relative to SaaS pricing.

### Revenue Levers

| Lever | Impact |
|-------|--------|
| **Annual billing** (20% discount) | Improves cash flow, reduces churn |
| **Team plans** (5+ seats) | Higher ACV, lower support cost per user |
| **Usage-based pricing** on ML runs | Captures value from heavy users |
| **Marketplace integrations** (MCP, CrewAI) | Expands TAM to AI/ML teams |
| **White-label / OEM** | $500-2,000/mo per partner |

---

## Summary

| Question | Answer |
|----------|--------|
| Initial users (Month 1) | 10-50 (free beta) |
| Break-even | Month 2-3 |
| Year 1 ARR (conservative) | ~$40,000 |
| Year 1 ARR (moderate) | ~$90,000 |
| Hosting cost at 1,000 users | $80-200/mo |
| License cost | $0 (all deps free) |
| Recommended starting price | Free + $19/$49/$149 tiers |
| Gross margin at scale | 85-95% (SaaS typical) |
