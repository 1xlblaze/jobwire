from datetime import datetime, timedelta, timezone

from src.collector import filter_jobs, is_recent, matches_python, strip_html


def test_matches_python(config):
    assert matches_python("Senior Python Developer", "", [], config.search.keywords)
    assert matches_python("Backend Engineer", "We use FastAPI and Postgres", [], config.search.keywords)
    assert matches_python("Platform Engineer", "", ["python", "k8s"], config.search.keywords)
    assert not matches_python(
        "C++/Kotlin Software Developer",
        "Experience with Python, Ruby, or Haskell is a plus.",
        ["Rust Engineering"],
        config.search.keywords,
    )
    assert not matches_python("Account Executive", "SaaS sales quota", ["sales"], config.search.keywords)


def test_recent_window():
    now = datetime.now(timezone.utc)
    assert is_recent(now - timedelta(hours=2), 24)
    assert not is_recent(now - timedelta(hours=48), 24)
    assert not is_recent(None, 24)


def test_filter_keeps_fresh_python_roles(config):
    now = datetime.now(timezone.utc)
    raw = [
        {
            "source": "remoteok",
            "external_id": "1",
            "title": "Python Developer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://example.com/1",
            "description": "FastAPI",
            "tags": ["python"],
            "posted_at": now.isoformat(),
            "_posted_dt": now,
        },
        {
            "source": "remoteok",
            "external_id": "2",
            "title": "Python Developer",
            "company": "Old Co",
            "location": "Remote",
            "url": "https://example.com/2",
            "description": "Django",
            "tags": ["python"],
            "posted_at": (now - timedelta(days=10)).isoformat(),
            "_posted_dt": now - timedelta(days=10),
        },
        {
            "source": "remoteok",
            "external_id": "3",
            "title": "Account Executive",
            "company": "Sales",
            "location": "Remote",
            "url": "https://example.com/3",
            "description": "quota",
            "tags": ["sales"],
            "posted_at": now.isoformat(),
            "_posted_dt": now,
        },
    ]
    kept = filter_jobs(raw, config)
    assert [j["external_id"] for j in kept] == ["1"]


def test_strip_html():
    assert strip_html("<p>Hello <b>world</b></p>") == "Hello world"


def test_dedup(store):
    job = {
        "source": "remotive",
        "external_id": "abc",
        "title": "Backend Engineer",
        "company": "Acme",
        "location": "Remote",
        "url": "https://example.com/abc",
        "description": "Python",
        "tags": ["python"],
        "posted_at": datetime.now(timezone.utc).isoformat(),
    }
    assert store.upsert_job(job) is True
    assert store.upsert_job(job) is False
    assert store.stats()["total"] == 1
