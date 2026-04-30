import os
from pathlib import Path


def _load_dotenv_if_present() -> None:
    """
    Load key=value pairs from a local `.env` file (project root) into process env.
    This avoids requiring users to manually set environment variables on Windows.

    - No external dependency (python-dotenv).
    - Existing environment variables win (we don't overwrite).
    """
    # backend/config.py -> project root is one level up from backend/
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        return

    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if not key:
                continue
            os.environ.setdefault(key, value)
    except Exception:
        # If `.env` can't be read, we fall back to regular env vars.
        return

# WARNING:
# Jangan hardcode Supabase key di repo. Isi lewat environment variable:
# - SUPABASE_URL
# - SUPABASE_KEY
_load_dotenv_if_present()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing Supabase config. Set SUPABASE_URL and SUPABASE_KEY environment variables "
        "or create a `.env` file in the project root."
    )