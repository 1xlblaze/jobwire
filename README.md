# Jobwire

Public Python job feeds into **Supabase**, a screening-answer copilot, and a Vercel web desk. It does **not** log into LinkedIn or Naukri, and it does **not** auto-apply.

## LinkedIn & Naukri

Those platforms are intentionally absent. Jobwire only reads **public** boards (RemoteOK, Remotive, Arbeitnow, Jobicy). There is no session reuse, Easy Apply automation, or anti-bot layer.

## Web app (Vercel)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://127.0.0.1:3000. Set the same `NEXT_PUBLIC_SUPABASE_*` values in the Vercel project after you connect Vercel, then deploy.

Hourly refresh is configured as a Vercel Cron hitting `GET /api/collect`.

## Local Python CLI (optional)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src collect
python -m src serve
```

## Chrome helper

Load unpacked `extension/` against the running web origin if you want Suggest answer on public ATS forms. It never submits.
