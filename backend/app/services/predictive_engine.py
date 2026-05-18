"""
Predictive Engine Service
Time-series forecasting with multi-algorithm model selection.
Automatically picks the best model (Linear, Polynomial, Exponential) via holdout RMSE.
"""
from typing import Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal model implementations (no extra deps beyond numpy)
# ---------------------------------------------------------------------------

def _linear_fit(x: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, float]:
    """Return (coefficients[m,b], rmse_on_full)"""
    coeffs = np.polyfit(x, y, 1)
    preds = np.polyval(coeffs, x)
    rmse = float(np.sqrt(np.mean((preds - y) ** 2)))
    return coeffs, rmse


def _polynomial_fit(x: np.ndarray, y: np.ndarray, degree: int = 2) -> Tuple[np.ndarray, float]:
    """Return (coefficients, rmse_on_full)"""
    coeffs = np.polyfit(x, y, degree)
    preds = np.polyval(coeffs, x)
    rmse = float(np.sqrt(np.mean((preds - y) ** 2)))
    return coeffs, rmse


def _ewm_forecast(y: np.ndarray, horizon: int, alpha: float = 0.3) -> Tuple[np.ndarray, float]:
    """
    Exponential Weighted Moving Average forecast.
    Returns (future_values[horizon], rmse_on_training).
    """
    smoothed = np.zeros(len(y))
    smoothed[0] = y[0]
    for i in range(1, len(y)):
        smoothed[i] = alpha * y[i] + (1 - alpha) * smoothed[i - 1]

    # Trend: last slope of the smoothed series
    if len(smoothed) >= 2:
        trend = smoothed[-1] - smoothed[-2]
    else:
        trend = 0.0

    future = np.array([
        max(0, smoothed[-1] + trend * (i + 1)) for i in range(horizon)
    ])
    rmse = float(np.sqrt(np.mean((smoothed - y) ** 2)))
    return future, rmse


def _select_best_model(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Train all three models on 80% of data, evaluate on 20% holdout.
    Returns the best model descriptor with its future-prediction function.
    """
    n = len(y)
    split = max(2, int(n * 0.8))
    x_train, y_train = x[:split], y[:split]
    x_test = x[split:]
    y_test = y[split:]

    results = {}

    # --- Linear ---
    try:
        c, _ = _linear_fit(x_train, y_train)
        if len(x_test):
            rmse = float(np.sqrt(np.mean((np.polyval(c, x_test) - y_test) ** 2)))
        else:
            _, rmse = _linear_fit(x, y)
        results['linear'] = {'coeffs': c, 'rmse': rmse, 'degree': 1}
    except Exception:
        pass

    # --- Polynomial (degree 2) ---
    try:
        c, _ = _polynomial_fit(x_train, y_train, 2)
        if len(x_test):
            rmse = float(np.sqrt(np.mean((np.polyval(c, x_test) - y_test) ** 2)))
        else:
            _, rmse = _polynomial_fit(x, y, 2)
        results['polynomial'] = {'coeffs': c, 'rmse': rmse, 'degree': 2}
    except Exception:
        pass

    # --- EWM (test on last 20% by rolling forward) ---
    try:
        alpha = 0.3
        smoothed = np.zeros(len(y_train))
        smoothed[0] = y_train[0]
        for i in range(1, len(y_train)):
            smoothed[i] = alpha * y_train[i] + (1 - alpha) * smoothed[i - 1]
        trend = smoothed[-1] - smoothed[-2] if len(smoothed) >= 2 else 0
        if len(x_test):
            ewm_preds = np.array([
                max(0, smoothed[-1] + trend * (i + 1)) for i in range(len(x_test))
            ])
            rmse = float(np.sqrt(np.mean((ewm_preds - y_test) ** 2)))
        else:
            _, rmse = _ewm_forecast(y, 1, alpha)
        results['ewm'] = {'rmse': rmse, 'last_smooth': smoothed[-1], 'trend': trend, 'alpha': alpha}
    except Exception:
        pass

    if not results:
        # Ultimate fallback
        c, rmse = _linear_fit(x, y)
        return {'name': 'linear', 'coeffs': c, 'rmse': rmse, 'degree': 1}

    best_name = min(results, key=lambda k: results[k]['rmse'])
    best = results[best_name]
    best['name'] = best_name
    return best


def _r_squared(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    if ss_tot == 0:
        return 1.0
    return float(1 - ss_res / ss_tot)


def _confidence_interval(residuals: np.ndarray, confidence: float = 0.95) -> float:
    """Return half-width for the given confidence level."""
    z = 1.96 if confidence == 0.95 else 2.576
    std = float(np.std(residuals)) if len(residuals) > 1 else 0.0
    return z * std


class PredictiveEngine:
    """
    Production-grade forecasting service.
    Algorithms: Linear Regression, Polynomial (degree-2), Exponential Weighted Moving Average.
    Model selection via holdout RMSE. Confidence intervals and R included in responses.
    """

    def __init__(self):
        self.forecast_horizon = 30  # Days

    async def forecast_table_growth(self, db_connector, connection_id: str, table_name: str) -> Dict[str, Any]:
        """Forecast row count growth for the next 30 days using the best-fit model."""
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type

            fq_table = await self._get_fq_table_name(db_connector, connection_id, table_name)

            # 1. Find timestamp column
            if is_mysql:
                query = f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                    AND data_type IN ('timestamp', 'datetime', 'date')
                    LIMIT 1
                """
            else:
                query = f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                    AND data_type IN ('timestamp', 'timestamp with time zone',
                                      'timestamp without time zone', 'date')
                    ORDER BY CASE
                        WHEN column_name ILIKE '%created%' THEN 1
                        WHEN column_name ILIKE '%updated%' THEN 2
                        WHEN column_name ILIKE '%reported%' THEN 3
                        WHEN column_name ILIKE '%at%' THEN 4
                        ELSE 5
                    END
                    LIMIT 1
                """
            cols = await db_connector.query(connection_id, query)
            if not cols:
                return await self._generate_fallback_prediction(
                    db_connector, connection_id, fq_table, table_name, db_type=db_type
                )

            ts_col = cols[0]['column_name']

            # 2. Fetch historical daily counts (last 60 days for better model training)
            lookback = 60
            if is_mysql:
                history_query = f"""
                    SELECT DATE({ts_col}) as day, COUNT(*) as count
                    FROM {fq_table}
                    WHERE {ts_col} >= DATE_SUB(NOW(), INTERVAL {lookback} DAY)
                    GROUP BY day ORDER BY day ASC
                """
            else:
                history_query = f"""
                    SELECT DATE({ts_col}) as day, COUNT(*) as count
                    FROM {fq_table}
                    WHERE {ts_col} >= NOW() - INTERVAL '{lookback} days'
                    GROUP BY day ORDER BY day ASC
                """
            history = await db_connector.query(connection_id, history_query)

            if len(history) < 3:
                return await self._generate_fallback_prediction(
                    db_connector, connection_id, fq_table, table_name,
                    reason="Insufficient historical trend data", db_type=db_type
                )

            x = np.array(range(len(history)), dtype=float)
            y = np.array([float(r['count']) for r in history])

            # 3. Select best model
            best = _select_best_model(x, y)

            # 4. Generate predictions
            predictions = []
            last_date = history[-1]['day']
            if isinstance(last_date, str):
                last_date = datetime.strptime(last_date[:10], "%Y-%m-%d")
            elif not last_date:
                last_date = datetime.now()

            n = len(history)
            future_x = np.array(range(n, n + self.forecast_horizon), dtype=float)

            if best['name'] == 'ewm':
                future_vals, _ = _ewm_forecast(y, self.forecast_horizon, best.get('alpha', 0.3))
                fitted_vals = np.array([
                    best['last_smooth'] + best['trend'] * (i - n + 1) for i in range(n)
                ])
            else:
                future_vals = np.polyval(best['coeffs'], future_x)
                fitted_vals = np.polyval(best['coeffs'], x)

            future_vals = np.clip(future_vals, 0, None)
            residuals = y - fitted_vals
            ci_half = _confidence_interval(residuals)
            r2 = _r_squared(y, fitted_vals)

            for i in range(self.forecast_horizon):
                pred_val = int(future_vals[i])
                pred_date = last_date + timedelta(days=i + 1)
                predictions.append({
                    "date": pred_date.strftime("%Y-%m-%d"),
                    "predicted_count": pred_val,
                    "lower_bound": max(0, int(pred_val - ci_half)),
                    "upper_bound": int(pred_val + ci_half),
                })

            # 5. Growth stats
            current_total_res = await db_connector.query(
                connection_id, f"SELECT COUNT(*) as total FROM {fq_table}"
            )
            current_total = current_total_res[0]['total'] if current_total_res else 0
            predicted_total_30d = current_total + int(sum(p['predicted_count'] for p in predictions))
            growth_pct = ((predicted_total_30d - current_total) / current_total * 100) if current_total > 0 else 0

            return {
                "table_name": table_name,
                "can_predict": True,
                "current_size": current_total,
                "predicted_size_30d": predicted_total_30d,
                "growth_percentage_30d": round(growth_pct, 1),
                "forecast": predictions,
                "risk_level": "High" if growth_pct > 50 else "Medium" if growth_pct > 20 else "Low",
                "summary": self._generate_forecast_summary(growth_pct, table_name, predicted_total_30d),
                "_model": {
                    "algorithm": best['name'],
                    "r_squared": round(r2, 4),
                    "rmse": round(best['rmse'], 2),
                    "confidence_interval_95": round(ci_half, 2),
                    "training_points": len(history),
                },
            }

        except Exception as e:
            logger.error(f"Forecasting failed for {table_name}: {e}")
            return {
                "error": str(e),
                "can_predict": False,
                "summary": f"Predictive analysis is currently initializing for {table_name}.",
            }

    async def _get_fq_table_name(self, db_connector, connection_id: str, table_name: str) -> str:
        db_connector.validate_identifier(table_name)
        check_query = f"""
            SELECT table_schema
            FROM information_schema.tables
            WHERE LOWER(table_name) = LOWER('{table_name}')
            AND table_schema IN ('evolution', 'public')
            ORDER BY CASE WHEN table_schema = 'public' THEN 1 ELSE 2 END
            LIMIT 1
        """
        res = await db_connector.query(connection_id, check_query)
        if res:
            return f"{res[0]['table_schema']}.{table_name}"
        return table_name

    async def _generate_fallback_prediction(
        self,
        db_connector,
        connection_id: str,
        fq_table: str,
        table_name: str,
        reason: str = None,
        db_type: str = 'postgres',
    ) -> Dict[str, Any]:
        """Estimate growth from system stats when historical data is unavailable."""
        current_total_res = await db_connector.query(
            connection_id, f"SELECT COUNT(*) as total FROM {fq_table}"
        )
        current_total = current_total_res[0]['total'] if current_total_res else 0

        daily_growth_rate = 0.0
        try:
            if 'postgres' in db_type or 'neon' in db_type:
                stat_q = "SELECT n_tup_ins FROM pg_stat_user_tables WHERE schemaname='public' AND relname=$1"
                stat_res = await db_connector.query(connection_id, stat_q, (table_name,))
                if stat_res and stat_res[0].get('n_tup_ins'):
                    n_tup_ins = int(stat_res[0]['n_tup_ins'])
                    if current_total > 0 and n_tup_ins > 0:
                        insertion_ratio = n_tup_ins / current_total
                        daily_growth_rate = min(insertion_ratio / 30, 0.05)
        except Exception:
            pass

        if daily_growth_rate == 0:
            daily_growth_rate = 0.02 / 30  # Conservative 2%/month

        predicted_total_30d = int(current_total * (1 + daily_growth_rate * 30))
        growth_pct = round(daily_growth_rate * 30 * 100, 2)
        increment = (predicted_total_30d - current_total) / 30
        base_date = datetime.now()

        predictions = [
            {
                "date": (base_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "predicted_count": int(current_total + increment * i),
                "lower_bound": max(0, int(current_total + increment * i * 0.85)),
                "upper_bound": int(current_total + increment * i * 1.15),
            }
            for i in range(1, 31)
        ]

        summary = f"Based on current system activity, {table_name} is projected to grow by {growth_pct}%."
        if reason:
            summary = f"Note: {reason}. {summary}"

        return {
            "table_name": table_name,
            "can_predict": True,
            "is_estimated": True,
            "current_size": current_total,
            "predicted_size_30d": predicted_total_30d,
            "growth_percentage_30d": growth_pct,
            "forecast": predictions,
            "risk_level": "Low" if growth_pct < 20 else "Medium",
            "summary": summary,
            "_model": {
                "algorithm": "heuristic_linear",
                "r_squared": None,
                "rmse": None,
                "confidence_interval_95": None,
                "training_points": 0,
            },
            "_meta": {
                "source": "heuristic_estimate",
                "model": "linear_extrapolation_from_current_count",
                "real_historical_data_used": False,
                "fallback_reason": reason or "insufficient_historical_data",
            },
        }

    def _generate_forecast_summary(self, growth_pct: float, table_name: str, predicted_total: int) -> str:
        if growth_pct > 100:
            return (
                f"Extreme growth alert: {table_name} is predicted to more than double in size "
                f"over the next 30 days, reaching approx. {predicted_total:,} rows."
            )
        if growth_pct > 20:
            return f"{table_name} is showing steady growth. Expected to grow by {growth_pct:.1f}% in the next 30 days."
        if growth_pct < -5:
            return f"{table_name} activity is slowing down. A slight decrease in data volume is expected."
        return f"{table_name} is predicted to remain stable with minimal growth in the coming month."

    async def forecast_system_growth(self, db_connector, connection_id: str) -> Dict[str, Any]:
        """System-wide growth forecast aggregating top tables."""
        try:
            connection = db_connector.get_connection(connection_id)
            db_type = connection['type'].lower()
            is_mysql = 'mysql' in db_type

            res = []
            if is_mysql:
                q = "SELECT table_name, table_rows as cnt FROM information_schema.tables WHERE table_schema = DATABASE()"
                res = await db_connector.query(connection_id, q)
            else:
                q = "SELECT relname as table_name, n_live_tup as cnt FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 50"
                res = await db_connector.query(connection_id, q)
                if not res or sum(r['cnt'] for r in res if r['cnt']) == 0:
                    q_tables = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5"
                    tables = await db_connector.query(connection_id, q_tables)
                    res = []
                    for t in tables:
                        tn = t['table_name']
                        try:
                            safe_tn = db_connector.validate_identifier(tn)
                            c = await db_connector.query(connection_id, f"SELECT COUNT(*) as cnt FROM {safe_tn}")
                            res.append({'table_name': tn, 'cnt': c[0]['cnt']})
                        except Exception as e:
                            logger.debug(f"Row count query failed for {tn}: {e}")

            if not res:
                return {"can_predict": False, "summary": "No accessible tables found for system forecast."}

            res = [r for r in res if r['cnt'] is not None]
            total_rows = sum(r['cnt'] for r in res)
            top_tables = sorted(res, key=lambda x: x['cnt'], reverse=True)[:5]

            if total_rows == 0:
                return {
                    "scope": "System Wide",
                    "current_total_rows": 0,
                    "predicted_total_rows": 0,
                    "growth_percentage_30d": 0,
                    "risk_level": "Low",
                    "summary": "System appears empty (0 rows detected).",
                }

            aggregated_growth_count = 0
            model_names = []
            for t in top_tables:
                f = await self.forecast_table_growth(db_connector, connection_id, t['table_name'])
                if f.get('can_predict'):
                    aggregated_growth_count += f['predicted_size_30d'] - f['current_size']
                    model_names.append(f.get('_model', {}).get('algorithm', 'unknown'))

            predicted_total = total_rows + aggregated_growth_count
            system_growth_pct = (aggregated_growth_count / total_rows * 100) if total_rows > 0 else 0

            return {
                "scope": "System Wide",
                "current_total_rows": total_rows,
                "predicted_total_rows": predicted_total,
                "growth_percentage_30d": round(system_growth_pct, 2),
                "risk_level": "High" if system_growth_pct > 20 else "Low",
                "summary": (
                    f"System contains {total_rows:,} rows. Projected to grow by "
                    f"{system_growth_pct:.1f}% (+{aggregated_growth_count:,} records) over 30 days."
                ),
                "_model": {"algorithms_used": list(set(model_names))},
            }

        except Exception as e:
            logger.error(f"System forecast failed: {e}")
            return {"error": str(e), "can_predict": False}


# Global instance
predictive_engine = PredictiveEngine()
