import pandas as pd
from types import SimpleNamespace

from app.api.time_series import _guess_date_column, _GRANULARITY_FREQ


def test_guess_date_column_by_type():
    cols = [SimpleNamespace(name="id", type="integer"), SimpleNamespace(name="signup", type="timestamp")]
    assert _guess_date_column(cols) == "signup"


def test_guess_date_column_by_name():
    cols = [SimpleNamespace(name="id", type="integer"), SimpleNamespace(name="created_at", type="text")]
    assert _guess_date_column(cols) == "created_at"


def test_guess_date_column_none_found():
    cols = [SimpleNamespace(name="id", type="integer"), SimpleNamespace(name="name", type="text")]
    assert _guess_date_column(cols) is None


def test_tz_aware_and_naive_timestamps_normalize_for_comparison():
    # Mixed tz-aware / tz-naive columns previously crashed min()/max() with
    # "Cannot compare tz-naive and tz-aware timestamps".
    naive = pd.to_datetime(pd.Series(["2023-01-01", "2023-01-02"]), errors="coerce", utc=True).dt.tz_localize(None)
    aware = pd.to_datetime(pd.Series(["2023-01-03T00:00:00+05:00"]), errors="coerce", utc=True).dt.tz_localize(None)
    combined = pd.concat([naive, aware])
    assert combined.min() == pd.Timestamp("2023-01-01")
    assert combined.max() == pd.Timestamp("2023-01-02T19:00:00")


def test_daily_grouping_counts_match_raw_data():
    df = pd.DataFrame({
        "created_at": pd.to_datetime([
            "2023-01-01", "2023-01-01", "2023-01-02",
            "2023-01-02", "2023-01-02", "2023-01-03",
        ])
    })
    bucketed = df["created_at"].dt.to_period(_GRANULARITY_FREQ["day"])
    counts = bucketed.value_counts().sort_index()

    expected = {"2023-01-01": 2, "2023-01-02": 3, "2023-01-03": 1}
    actual = {str(period.start_time.date()): int(count) for period, count in counts.items()}
    assert actual == expected

    assert str(df["created_at"].min().date()) == "2023-01-01"
    assert str(df["created_at"].max().date()) == "2023-01-03"
