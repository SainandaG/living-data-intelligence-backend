# Snowflake Marketplace Integration

Two paths exist. Pick one — don't build both.

| | Path A: External Listing | Path B: Native App (SPCS) |
|---|---|---|
| Effort | Low (~1 day) | High (weeks) |
| Code changes | One connector + optional OAuth | Containerize FastAPI + frontend, rewrite DB access to Snowflake |
| Where it runs | Your own infra (as today) | Inside customer's Snowflake account |
| Fit for this repo | ✅ — connects to Postgres/MySQL/Mongo/CSV today, not Snowflake-native | Only if customers demand data never leaving their Snowflake account |

**Recommendation: Path A.** Nothing here forces a rewrite to be Snowflake-native; the Marketplace supports listing SaaS products that simply *integrate* with Snowflake (e.g. via a connector or OAuth).

---

## Prerequisites

- A Snowflake account with `ACCOUNTADMIN` (or ability to ask someone who has it) — needed for the security integration and Provider Studio enrollment.
- Provider status in [Provider Studio](https://app.snowflake.com) (Data Products → Provider Studio) — request access; public listings need Snowflake approval, personalized listings don't.
- This repo's existing multi-DB connector pattern in `backend/app/services/` (already supports Postgres/MySQL/Mongo — Snowflake is one more adapter, not a new pattern).
- Existing OAuth plumbing in `backend/app/api/auth.py` (`/google`) — reused as-is for Snowflake OAuth, no new framework.

---

## Path A — External/SaaS Listing (fastest)

1. **Snowflake account**: sign up with `ORGADMIN`/`ACCOUNTADMIN` access (a trial account works for listing setup).
2. **Enroll as a Provider**: Snowsight → *Data Products → Provider Studio* → request Provider status.
3. **Add a Snowflake connector to this app** (the only required code work):
   - `pip install snowflake-connector-python` (or `snowflake-sqlalchemy`, since the project already uses SQLAlchemy) — add to `backend/requirements.txt`.
   - Add a `snowflake` adapter in `backend/app/services/` alongside the existing Postgres/MySQL/Mongo adapters, following the same interface.
4. **Support Snowflake OAuth login** (optional for the listing, required if you want "Snowflake account holders only" — see next section).
5. **Create the listing** in Provider Studio:
   - Title, description, category, support/contact info.
   - Listing type: "Personalized Listing" (per-customer, sales-assisted) to start; "Public Listing" once you want self-serve discovery.
   - Attach pricing terms (free trial, contact-for-pricing, etc.).
6. **Submit for review** — public listings get a Snowflake security/compliance review; personalized listings skip it.
7. **Publish** — share the listing link, or let it surface in Marketplace search once approved.

---

## Path B — Native App via Snowpark Container Services

Only if a customer contractually requires the app to run *inside* their Snowflake account (no data egress).

1. Containerize `backend/` and `frontend/` — add Dockerfiles (none exist today).
2. Replace direct Postgres/MySQL/Mongo/DuckDB access with Snowflake tables/stages, or keep external DB access via Snowflake's External Network Access (needs account-level allowlisting).
3. Write the Native App manifest (`manifest.yml`), setup script (SQL), and application package using the `snow` CLI.
4. Define an SPCS service spec (YAML) for the API + frontend containers; push images to the app's private Snowflake image repository.
5. Test with `snow app run` locally, then in a test Snowflake account.
6. Submit the Application Package for Marketplace review (stricter — includes security review of the setup script and containers).
7. Publish as a Native App listing.

---

## Gating access to Snowflake account holders only

To make login *require* a real Snowflake account (not just "connect to Snowflake as a data source"), swap the login flow for Snowflake OAuth. Same shape as the existing Google login in [auth.py:117](../backend/app/api/auth.py) (`/google` — verifies a Firebase ID token, upserts the user, issues the app's own JWT) — do the same but verify a Snowflake OAuth token instead. The Snowflake-hosted consent screen *is* the gate: no Snowflake login, no token.

1. **Register an OAuth security integration in Snowflake** (as `ACCOUNTADMIN`):
   ```sql
   CREATE SECURITY INTEGRATION snowflake_app_oauth
     TYPE = OAUTH
     OAUTH_CLIENT = CUSTOM
     OAUTH_REDIRECT_URI = 'https://your-app.com/api/auth/snowflake/callback'
     OAUTH_ISSUE_REFRESH_TOKENS = TRUE
     ENABLED = TRUE;
   ```
   This produces a client ID/secret and authorize/token URLs scoped to that Snowflake account.

2. **Env vars** (add to `.env` / deployment secrets, next to the existing `FIREBASE_SERVICE_ACCOUNT_KEY`):
   ```
   SNOWFLAKE_OAUTH_CLIENT_ID=...
   SNOWFLAKE_OAUTH_CLIENT_SECRET=...
   SNOWFLAKE_ACCOUNT_URL=https://<account>.snowflakecomputing.com
   SNOWFLAKE_OAUTH_REDIRECT_URI=https://your-app.com/api/auth/snowflake/callback
   ```

3. **Frontend** (`frontend/src/components/Auth/AuthPage.jsx`): add a "Sign in with Snowflake" button next to the existing Google button, linking to `{SNOWFLAKE_ACCOUNT_URL}/oauth/authorize?client_id=...&response_type=code&redirect_uri=...`.

4. **Backend — new `/snowflake/callback` route** in `backend/app/api/auth.py`, next to `google_login` (~line 117):
   - Exchange the returned `code` for an access token via `POST {SNOWFLAKE_ACCOUNT_URL}/oauth/token-request`.
   - Call `SELECT CURRENT_USER(), CURRENT_ACCOUNT()` with that token to confirm it's a real, active Snowflake user — this check alone enforces "Snowflake account holders only."
   - Upsert into the `users` table exactly like `google_login` does (same `role`/`tenant_id` defaults), then issue this app's own `access_token`/`refresh_token` via `create_access_token`/`create_refresh_token` so RBAC, tenants, and permissions downstream are unchanged.
5. **Lock the door**: in production, disable/hide `/login` (email+password) and `/register` so Snowflake OAuth is the only way in — either remove the routes or gate them behind an env flag (e.g. `ALLOW_PASSWORD_LOGIN=false`).

This reuses ~90% of the existing Google-OAuth plumbing already in `auth.py` — no new auth framework needed.

---

## Checklist

- [ ] Snowflake account + `ACCOUNTADMIN` access confirmed
- [ ] Provider Studio access requested/granted
- [ ] Snowflake connector added to `backend/app/services/`
- [ ] `snowflake_app_oauth` security integration created
- [ ] Env vars set (`SNOWFLAKE_OAUTH_CLIENT_ID/SECRET`, `SNOWFLAKE_ACCOUNT_URL`, redirect URI)
- [ ] "Sign in with Snowflake" button added to `AuthPage.jsx`
- [ ] `/snowflake/callback` route implemented in `auth.py`
- [ ] Password login/register disabled or flagged off in production
- [ ] Listing created in Provider Studio and submitted for review
- [ ] Listing published

---

## Decision point

Given this repo's current architecture (FastAPI + external DB connectors + Torch/TF ML + React), **Path A** ships without touching the ML/graph/analytics code at all. Revisit Path B only if a specific customer contractually requires in-account execution.
