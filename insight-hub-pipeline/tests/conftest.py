from pathlib import Path

import psycopg
import pytest

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "insight-hub-web" / "drizzle"


def _docker_available() -> bool:
    try:
        import docker

        docker.from_env().ping()
        return True
    except Exception:
        return False


requires_docker = pytest.mark.skipif(
    not _docker_available(),
    reason="Docker is not available/running — cannot start the ephemeral Postgres test container",
)


@pytest.fixture(scope="session")
def postgres_dsn():
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as container:
        dsn = container.get_connection_url(driver=None)
        with psycopg.connect(dsn) as conn:
            for migration_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
                conn.execute(migration_file.read_text())
            conn.commit()
        yield dsn


@pytest.fixture
def db_conn(postgres_dsn):
    with psycopg.connect(postgres_dsn) as conn:
        conn.execute("TRUNCATE TABLE messages, import_runs, themes RESTART IDENTITY CASCADE")
        conn.commit()
    conn = psycopg.connect(postgres_dsn)
    yield conn
    conn.close()
