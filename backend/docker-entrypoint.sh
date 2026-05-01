#!/bin/sh
set -eu

if [ "${SKIP_DB_WAIT:-0}" != "1" ]; then
  python - <<'PY'
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import get_settings

database_url = get_settings().database_url
engine = create_engine(database_url, pool_pre_ping=True)

for attempt in range(1, 31):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("Database is reachable.", flush=True)
        break
    except OperationalError as exc:
        if attempt == 30:
            print(
                "Database is not reachable after 60 seconds. "
                "Check DATABASE_URL and make sure the Postgres container is on the same Docker network.",
                file=sys.stderr,
                flush=True,
            )
            raise
        print(f"Waiting for database ({attempt}/30): {exc.orig}", flush=True)
        time.sleep(2)
PY
fi

exec "$@"
