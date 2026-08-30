from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import uvicorn

from src.collector import collect_all
from src.config_loader import load_config
from src.db import JobStore
from src.llm_solver import solve_question
from src.web import create_app


def _store() -> JobStore:
    return JobStore()


async def cmd_collect() -> None:
    config = load_config()
    store = _store()
    results = await collect_all(config, store)
    for row in results:
        flag = "ok" if not row.get("error") else "ERR"
        print(
            f"[{flag}] {row['source']}: found={row['found']} inserted={row['inserted']}"
            + (f" error={row['error']}" if row.get("error") else "")
        )
    stats = store.stats()
    print(f"ledger total={stats['total']} by_status={stats['by_status']}")


async def cmd_answer(question: str, job_id: int | None) -> None:
    config = load_config()
    store = _store()
    job = store.get_job(job_id) if job_id else None
    result = await solve_question(question, config, job=job)
    print(result["answer"])
    print(f"(source={result['source']} provider={result['provider']})")


def cmd_serve(poll: bool) -> None:
    config = load_config()
    store = _store()
    app = create_app(config, store, poll=poll)
    host = os.environ.get("JOBWIRE_HOST", config.agent.host)
    port = int(os.environ.get("JOBWIRE_PORT", config.agent.port))
    uvicorn.run(app, host=host, port=port, log_level="info")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Jobwire — public job feeds + screening-answer helper"
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("collect", help="Fetch public Python job feeds once")
    answer = sub.add_parser("answer", help="Draft a screening answer from local profile")
    answer.add_argument("question")
    answer.add_argument("--job-id", type=int, default=None)
    serve = sub.add_parser("serve", help="Run the local dashboard and API")
    serve.add_argument(
        "--poll",
        action="store_true",
        help="Re-fetch public feeds on the configured interval",
    )
    return parser


def main() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

    parser = build_parser()
    args = parser.parse_args()
    command = args.command or "serve"

    if command == "collect":
        asyncio.run(cmd_collect())
    elif command == "answer":
        asyncio.run(cmd_answer(args.question, args.job_id))
    else:
        cmd_serve(poll=getattr(args, "poll", False))


if __name__ == "__main__":
    main()
