from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from src.collector import collect_all
from src.config_loader import AppConfig
from src.db import JobStore
from src.llm_solver import solve_question


APP_DIR = Path(__file__).resolve().parent


class SuggestBody(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    job_id: int | None = None
    job_title: str | None = None
    job_company: str | None = None
    job_description: str | None = None
    force_llm: bool = False


class StatusBody(BaseModel):
    status: str


def create_app(
    config: AppConfig,
    store: JobStore,
    seed_on_start: bool = True,
    poll: bool = False,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        tasks: list[asyncio.Task] = []
        if seed_on_start and store.stats()["total"] == 0:
            tasks.append(asyncio.create_task(collect_all(config, store)))
        if poll:
            interval = max(5, config.agent.polling_interval_minutes) * 60

            async def loop() -> None:
                await asyncio.sleep(2)
                while True:
                    try:
                        await collect_all(config, store)
                    except Exception:
                        pass
                    await asyncio.sleep(interval)

            tasks.append(asyncio.create_task(loop()))
        app.state.background_tasks = tasks
        yield

    app = FastAPI(title="Jobwire", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def preview_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = (
            "frame-ancestors *; default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'"
        )
        return response
    templates = Jinja2Templates(directory=str(APP_DIR / "templates"))
    app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def home(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "candidate_name": config.candidate.full_name,
                "lookback_hours": config.agent.lookback_hours,
                "jobs": store.list_jobs(limit=50),
                "stats": store.stats(),
            },
        )

    @app.get("/practice", response_class=HTMLResponse)
    async def practice(request: Request) -> HTMLResponse:
        return templates.TemplateResponse(request, "practice.html", {})

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, "service": "jobwire"}

    @app.get("/api/profile")
    async def profile() -> dict[str, Any]:
        c = config.candidate
        return {
            "name": c.full_name,
            "email": c.email,
            "location": c.location,
            "experience_years": c.experience_years,
            "notice_period_days": c.notice_period_days,
            "skills": c.skills,
            "remote_preference": c.remote_preference,
        }

    @app.get("/api/stats")
    async def stats() -> dict[str, Any]:
        data = store.stats()
        data["runs"] = store.recent_runs(12)
        return data

    @app.get("/api/jobs")
    async def jobs(
        status: str | None = None,
        source: str | None = None,
        q: str | None = None,
    ) -> dict[str, Any]:
        items = store.list_jobs(status=status, source=source, query=q)
        return {"jobs": items, "count": len(items)}

    @app.get("/api/jobs/{job_id}")
    async def job_detail(job_id: int) -> dict[str, Any]:
        job = store.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    @app.post("/api/jobs/{job_id}/status")
    async def job_status(job_id: int, body: StatusBody) -> dict[str, Any]:
        try:
            job = store.set_status(job_id, body.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    @app.post("/api/collect")
    async def collect() -> dict[str, Any]:
        results = await collect_all(config, store)
        return {"results": results, "stats": store.stats()}

    @app.post("/api/suggest")
    async def suggest(body: SuggestBody) -> dict[str, Any]:
        job: dict[str, Any] | None = None
        if body.job_id is not None:
            job = store.get_job(body.job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
        elif body.job_title or body.job_description:
            job = {
                "title": body.job_title or "",
                "company": body.job_company or "",
                "description": body.job_description or "",
            }
        result = await solve_question(
            body.question, config, job=job, force_llm=body.force_llm
        )
        result["question"] = body.question
        return result

    return app
