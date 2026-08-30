# Jobwire

Public Python job feeds into **Supabase**, a screening-answer copilot, and a Vercel web desk. It does **not** log into LinkedIn or Naukri, and it does **not** auto-apply.

## LinkedIn & Naukri

Jobwire does not scrape or auto-apply on those sites. It does:

- Open LinkedIn / Naukri search pages for Python roles posted recently
- Let you paste a listing URL + description into the ledger
- Draft screening answers for that listing
- Leave Apply to you (or the Chrome Suggest helper)

## Web app (Vercel)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://127.0.0.1:3000. Production uses the 1xlblaze Supabase project by default; override with `NEXT_PUBLIC_SUPABASE_*` in Vercel if you switch databases.

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
