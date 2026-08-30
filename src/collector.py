from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Awaitable

import feedparser
import httpx
from dateutil import parser as date_parser

from src.config_loader import AppConfig
from src.db import JobStore


USER_AGENT = "Jobwire/1.0 (+local job feed reader; not a browser automation agent)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)

PYTHON_RE = re.compile(
    r"\b(python|django|fastapi|flask|pytest|celery|sqlalchemy)\b",
    re.IGNORECASE,
)

FetchFn = Callable[[httpx.AsyncClient, AppConfig], Awaitable[list[dict[str, Any]]]]


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 10_000_000_000:
            ts = ts / 1000.0
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except (OSError, ValueError, OverflowError):
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = date_parser.parse(text)
    except (ValueError, OverflowError, TypeError):
        try:
            parsed = parsedate_to_datetime(text)
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat()


def is_recent(posted_at: datetime | None, lookback_hours: int) -> bool:
    if posted_at is None:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    return posted_at >= cutoff


def matches_python(title: str, description: str, tags: list[str], keywords: list[str]) -> bool:
    blob = f"{title} {description} {' '.join(tags)}".lower()
    if PYTHON_RE.search(blob):
        return True
    return any(kw.lower() in blob for kw in keywords)


def stable_id(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _headers() -> dict[str, str]:
    return {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
    }


async def fetch_remoteok(client: httpx.AsyncClient, config: AppConfig) -> list[dict[str, Any]]:
    response = await client.get("https://remoteok.com/api")
    response.raise_for_status()
    payload = response.json()
    jobs: list[dict[str, Any]] = []
    if not isinstance(payload, list):
        return jobs
    for item in payload:
        if not isinstance(item, dict) or "id" not in item:
            continue
        title = str(item.get("position") or item.get("title") or "")
        tags = [str(t) for t in (item.get("tags") or [])]
        description = strip_html(str(item.get("description") or ""))
        posted = _parse_dt(item.get("epoch") or item.get("date"))
        jobs.append(
            {
                "source": "remoteok",
                "external_id": str(item.get("id") or item.get("slug") or title),
                "title": title,
                "company": str(item.get("company") or ""),
                "location": str(item.get("location") or "Remote"),
                "url": str(item.get("url") or item.get("apply_url") or ""),
                "description": description,
                "tags": tags,
                "posted_at": iso(posted),
                "_posted_dt": posted,
            }
        )
    return jobs


async def fetch_remotive(client: httpx.AsyncClient, config: AppConfig) -> list[dict[str, Any]]:
    response = await client.get(
        "https://remotive.com/api/remote-jobs",
        params={"search": "python", "limit": 100},
    )
    response.raise_for_status()
    payload = response.json()
    jobs: list[dict[str, Any]] = []
    for item in payload.get("jobs") or []:
        posted = _parse_dt(item.get("publication_date"))
        title = str(item.get("title") or "")
        jobs.append(
            {
                "source": "remotive",
                "external_id": str(item.get("id") or title),
                "title": title,
                "company": str(item.get("company_name") or ""),
                "location": str(item.get("candidate_required_location") or "Remote"),
                "url": str(item.get("url") or ""),
                "description": strip_html(str(item.get("description") or "")),
                "tags": [str(t) for t in (item.get("tags") or [])],
                "posted_at": iso(posted),
                "_posted_dt": posted,
            }
        )
    return jobs


async def fetch_arbeitnow(client: httpx.AsyncClient, config: AppConfig) -> list[dict[str, Any]]:
    response = await client.get("https://www.arbeitnow.com/api/job-board-api")
    response.raise_for_status()
    payload = response.json()
    jobs: list[dict[str, Any]] = []
    for item in payload.get("data") or []:
        posted = _parse_dt(item.get("created_at"))
        title = str(item.get("title") or "")
        jobs.append(
            {
                "source": "arbeitnow",
                "external_id": str(item.get("slug") or title),
                "title": title,
                "company": str(item.get("company_name") or ""),
                "location": str(item.get("location") or ("Remote" if item.get("remote") else "")),
                "url": str(item.get("url") or ""),
                "description": strip_html(str(item.get("description") or "")),
                "tags": [str(t) for t in (item.get("tags") or [])],
                "posted_at": iso(posted),
                "_posted_dt": posted,
            }
        )
    return jobs


async def fetch_jobicy(client: httpx.AsyncClient, config: AppConfig) -> list[dict[str, Any]]:
    response = await client.get(
        "https://jobicy.com/api/v2/remote-jobs",
        params={"count": 50, "tag": "python"},
    )
    response.raise_for_status()
    payload = response.json()
    jobs: list[dict[str, Any]] = []
    for item in payload.get("jobs") or []:
        posted = _parse_dt(item.get("pubDate") or item.get("jobPubDate"))
        title = str(item.get("jobTitle") or item.get("title") or "")
        jobs.append(
            {
                "source": "jobicy",
                "external_id": str(item.get("id") or title),
                "title": title,
                "company": str(item.get("companyName") or ""),
                "location": str(item.get("jobGeo") or "Remote"),
                "url": str(item.get("url") or item.get("jobUrl") or ""),
                "description": strip_html(
                    str(item.get("jobDescription") or item.get("jobExcerpt") or "")
                ),
                "tags": [str(t) for t in (item.get("jobTags") or item.get("tags") or [])]
                if isinstance(item.get("jobTags") or item.get("tags"), list)
                else [],
                "posted_at": iso(posted),
                "_posted_dt": posted,
            }
        )
    return jobs


async def fetch_weworkremotely(client: httpx.AsyncClient, config: AppConfig) -> list[dict[str, Any]]:
    response = await client.get(
        "https://weworkremotely.com/categories/remote-programming-jobs.rss"
    )
    response.raise_for_status()
    parsed = feedparser.parse(response.text)
    jobs: list[dict[str, Any]] = []
    for entry in parsed.entries:
        title = str(entry.get("title") or "")
        company = ""
        if ":" in title:
            company, _, rest = title.partition(":")
            company, title = company.strip(), rest.strip() or title
        posted = None
        if entry.get("published"):
            posted = _parse_dt(entry.get("published"))
        elif entry.get("updated"):
            posted = _parse_dt(entry.get("updated"))
        elif entry.get("published_parsed"):
            try:
                posted = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                posted = None
        url = str(entry.get("link") or "")
        description = strip_html(str(entry.get("summary") or entry.get("description") or ""))
        jobs.append(
            {
                "source": "weworkremotely",
                "external_id": str(entry.get("id") or stable_id(url, title)),
                "title": title,
                "company": company,
                "location": "Remote",
                "url": url,
                "description": description,
                "tags": ["remote", "programming"],
                "posted_at": iso(posted),
                "_posted_dt": posted,
            }
        )
    return jobs


SOURCES: dict[str, FetchFn] = {
    "remoteok": fetch_remoteok,
    "remotive": fetch_remotive,
    "arbeitnow": fetch_arbeitnow,
    "jobicy": fetch_jobicy,
    "weworkremotely": fetch_weworkremotely,
}


def filter_jobs(raw_jobs: list[dict[str, Any]], config: AppConfig) -> list[dict[str, Any]]:
    lookback = config.agent.lookback_hours
    keywords = config.search.keywords
    kept: list[dict[str, Any]] = []
    for job in raw_jobs:
        title = job.get("title") or ""
        description = job.get("description") or ""
        tags = job.get("tags") or []
        posted = job.get("_posted_dt")
        if not matches_python(title, description, tags, keywords):
            continue
        if not is_recent(posted, lookback):
            continue
        cleaned = {k: v for k, v in job.items() if not k.startswith("_")}
        kept.append(cleaned)
    return kept


async def collect_source(
    name: str,
    client: httpx.AsyncClient,
    config: AppConfig,
    store: JobStore,
) -> dict[str, Any]:
    fetch = SOURCES.get(name)
    if fetch is None:
        return {"source": name, "found": 0, "inserted": 0, "error": "unknown source"}
    run_id = store.start_run(name)
    try:
        raw = await fetch(client, config)
        matched = filter_jobs(raw, config)
        inserted = 0
        for job in matched:
            if store.upsert_job(job):
                inserted += 1
        store.finish_run(run_id, jobs_found=len(matched), jobs_inserted=inserted)
        return {"source": name, "found": len(matched), "inserted": inserted, "error": None}
    except Exception as exc:  # noqa: BLE001 — surface source errors in the dashboard
        store.finish_run(run_id, jobs_found=0, jobs_inserted=0, error=str(exc))
        return {"source": name, "found": 0, "inserted": 0, "error": str(exc)}


async def collect_all(config: AppConfig, store: JobStore) -> list[dict[str, Any]]:
    names = [name for name in config.search.sources if name in SOURCES]
    async with httpx.AsyncClient(headers=_headers(), timeout=TIMEOUT, follow_redirects=True) as client:
        results = await asyncio.gather(
            *[collect_source(name, client, config, store) for name in names]
        )
    return list(results)
