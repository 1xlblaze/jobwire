# Jobwire

Local job-hunt assistant: public Python job feeds into SQLite, a screening-answer copilot from your resume, and an optional Chrome helper that **suggests** answers. It does **not** log into LinkedIn or Naukri, does **not** click Apply, and does **not** store site cookies.

## What it does

1. **Job discovery** — Polls public APIs/RSS (RemoteOK, Remotive, Arbeitnow, Jobicy, We Work Remotely) for Python-related openings posted in the last 24 hours and records them in `database/jobs.db`.
2. **Screening answers** — Fills common fields from `config.yaml` (notice period, CTC, years per skill). Qualitative questions use OpenAI or Gemini when a key is present; otherwise a resume-based draft.
3. **Suggest Answer helper** — A Chrome extension (or Tampermonkey script) adds a button on typical application forms. You review and insert. Nothing is submitted for you.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# optional LLM keys
cp .env.example .env

python -m src collect          # fetch public feeds once
python -m src answer "Years of experience in Docker?"
python -m src serve            # dashboard at http://127.0.0.1:43141
python -m src serve --poll     # same, plus periodic refresh
```

Edit `config.yaml` and `resume.txt` before you rely on the drafts.

```bash
pytest
```

## Chrome extension

1. Start Jobwire (`python -m src serve`).
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → select the `extension/` folder.
3. Open the popup and ping `http://127.0.0.1:43141`.
4. On a careers/apply page, a **Suggest answer** button appears next to screening fields. **Insert** puts text in the box. It never submits the form.

Tampermonkey users can install `userscript/jobwire-suggest.user.js`. Mixed-content rules on HTTPS pages may block `http://127.0.0.1`; the extension is the reliable path.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/jobs` | List stored openings (`status`, `source`, `q`) |
| POST | `/api/collect` | Pull public feeds now |
| POST | `/api/suggest` | `{ "question": "...", "job_id": 1 }` |
| POST | `/api/jobs/{id}/status` | `new` / `saved` / `dismissed` |

## Layout

```text
config.yaml          # search keywords + candidate profile
resume.txt           # pasted into the LLM prompt
database/jobs.db     # created on first run
src/collector.py     # public feed parsers
src/llm_solver.py    # heuristics + optional LLM
src/web.py           # dashboard + API
extension/           # Chrome MV3 helper
userscript/          # Tampermonkey alternative
```
