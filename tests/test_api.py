def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_dashboard(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "The Jobwire" in res.text


def test_practice_form(client):
    res = client.get("/practice")
    assert res.status_code == 200
    assert "Practice application" in res.text


def test_suggest_heuristic(client):
    res = client.post("/api/suggest", json={"question": "Years of experience in Docker?"})
    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "3"
    assert body["source"] == "heuristic"


def test_suggest_why(client):
    res = client.post(
        "/api/suggest",
        json={
            "question": "Why this role?",
            "job_title": "Senior Python Developer",
            "job_company": "Northwind",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"]
    assert body["source"] in {"template", "llm"}


def test_job_status_roundtrip(client, store):
    store.upsert_job(
        {
            "source": "jobicy",
            "external_id": "z1",
            "title": "Python Developer",
            "company": "Zed",
            "location": "Remote",
            "url": "https://example.com/z1",
            "description": "FastAPI",
            "tags": ["python"],
            "posted_at": "2026-08-30T00:00:00+00:00",
        }
    )
    listed = client.get("/api/jobs").json()["jobs"]
    job_id = listed[0]["id"]
    updated = client.post(f"/api/jobs/{job_id}/status", json={"status": "saved"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "saved"
