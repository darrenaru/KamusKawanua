import os

from supabase import create_client

from backend.config import SUPABASE_KEY, SUPABASE_URL


def _get_env(name: str) -> str | None:
    value = os.getenv(name)
    return value if value and value.strip() else None


supabase = create_client(
    _get_env("SUPABASE_URL") or SUPABASE_URL,
    _get_env("SUPABASE_KEY") or SUPABASE_KEY,
)

