"""Strip unknown Supabase columns when PostgREST schema lags behind app payloads."""

from __future__ import annotations

import re
from typing import Any


def parse_missing_column_from_error(error: BaseException) -> str | None:
    parts: list[str] = [str(error)]
    for attr in ("message", "details", "hint"):
        val = getattr(error, attr, None)
        if val:
            parts.append(str(val))
    msg = " ".join(parts)
    m = re.search(
        r"Could not find the ['\"]([^'\"]+)['\"] column",
        msg,
        re.IGNORECASE,
    )
    if m:
        return m.group(1)
    m = re.search(
        r"column ['\"]?([^'\"\s]+)['\"]? (?:of relation|does not exist)",
        msg,
        re.IGNORECASE,
    )
    if m:
        return m.group(1)
    if re.search(r"roc[\s_-]?auc", msg, re.IGNORECASE):
        if "train_roc" in msg.lower():
            return "train_roc_auc"
        if "test_roc" in msg.lower():
            return "test_roc_auc"
    return None


def update_table_row_with_column_fallback(
    *,
    table: Any,
    payload: dict[str, Any],
    eq_column: str,
    eq_value: Any,
    max_attempts: int = 24,
) -> Any:
    """
    Run Supabase update; on missing-column errors, drop that key and retry.
    Raises the last error if retries are exhausted.
    """
    row = dict(payload)
    last_error: BaseException | None = None
    for _ in range(max_attempts):
        if not row:
            break
        try:
            return table.update(row).eq(eq_column, eq_value).execute()
        except Exception as e:
            last_error = e
            missing = parse_missing_column_from_error(e)
            if missing and missing in row:
                del row[missing]
                continue
            raise
    if last_error is not None:
        raise last_error
    raise RuntimeError("update_table_row_with_column_fallback: no attempts made")
