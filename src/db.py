from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ROOT / "database" / "jobs.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    url TEXT,
    description TEXT,
    tags TEXT,
    posted_at TEXT,
    discovered_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs (posted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs (source);

CREATE TABLE IF NOT EXISTS fetch_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    jobs_found INTEGER DEFAULT 0,
    jobs_inserted INTEGER DEFAULT 0,
    error TEXT
);
"""


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class JobStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path else DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    def upsert_job(self, job: dict[str, Any]) -> bool:
        """Insert a job if new. Returns True when a row was inserted."""
        tags = job.get("tags") or []
        if isinstance(tags, list):
            tags_json = json.dumps(tags)
        else:
            tags_json = json.dumps([str(tags)])
        payload = {
            "source": job["source"],
            "external_id": str(job["external_id"]),
            "title": job["title"],
            "company": job.get("company") or "",
            "location": job.get("location") or "",
            "url": job.get("url") or "",
            "description": job.get("description") or "",
            "tags": tags_json,
            "posted_at": job.get("posted_at"),
            "discovered_at": utcnow_iso(),
            "status": "new",
        }
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO jobs (
                    source, external_id, title, company, location, url,
                    description, tags, posted_at, discovered_at, status
                ) VALUES (
                    :source, :external_id, :title, :company, :location, :url,
                    :description, :tags, :posted_at, :discovered_at, :status
                )
                """,
                payload,
            )
            return cursor.rowcount > 0

    def list_jobs(
        self,
        status: str | None = None,
        source: str | None = None,
        query: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        clauses = ["1=1"]
        params: list[Any] = []
        if status:
            clauses.append("status = ?")
            params.append(status)
        if source:
            clauses.append("source = ?")
            params.append(source)
        if query:
            like = f"%{query.lower()}%"
            clauses.append(
                "(lower(title) LIKE ? OR lower(company) LIKE ? OR lower(description) LIKE ?)"
            )
            params.extend([like, like, like])
        params.append(limit)
        sql = f"""
            SELECT * FROM jobs
            WHERE {' AND '.join(clauses)}
            ORDER BY COALESCE(posted_at, discovered_at) DESC
            LIMIT ?
        """
        with self.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_job(row) for row in rows]

    def get_job(self, job_id: int) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return self._row_to_job(row) if row else None

    def set_status(self, job_id: int, status: str) -> dict[str, Any] | None:
        if status not in {"new", "saved", "dismissed"}:
            raise ValueError("status must be new, saved, or dismissed")
        with self.connect() as conn:
            conn.execute("UPDATE jobs SET status = ? WHERE id = ?", (status, job_id))
        return self.get_job(job_id)

    def stats(self) -> dict[str, Any]:
        with self.connect() as conn:
            by_status = {
                row["status"]: row["n"]
                for row in conn.execute(
                    "SELECT status, COUNT(*) AS n FROM jobs GROUP BY status"
                )
            }
            by_source = {
                row["source"]: row["n"]
                for row in conn.execute(
                    "SELECT source, COUNT(*) AS n FROM jobs GROUP BY source"
                )
            }
            latest = conn.execute(
                "SELECT MAX(finished_at) AS ts FROM fetch_runs WHERE error IS NULL OR error = ''"
            ).fetchone()
        return {
            "total": sum(by_status.values()),
            "by_status": by_status,
            "by_source": by_source,
            "last_successful_fetch": latest["ts"] if latest else None,
        }

    def start_run(self, source: str) -> int:
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO fetch_runs (source, started_at, jobs_found, jobs_inserted)
                VALUES (?, ?, 0, 0)
                """,
                (source, utcnow_iso()),
            )
            return int(cursor.lastrowid)

    def finish_run(
        self,
        run_id: int,
        jobs_found: int,
        jobs_inserted: int,
        error: str | None = None,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE fetch_runs
                SET finished_at = ?, jobs_found = ?, jobs_inserted = ?, error = ?
                WHERE id = ?
                """,
                (utcnow_iso(), jobs_found, jobs_inserted, error, run_id),
            )

    def recent_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM fetch_runs
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def _row_to_job(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        try:
            data["tags"] = json.loads(data.get("tags") or "[]")
        except json.JSONDecodeError:
            data["tags"] = []
        return data
