# Jobwire

Public Python job feeds into **Supabase**, a screening-answer copilot, and a Vercel web desk. It does **not** log into LinkedIn or Naukri, and it does **not** auto-apply.

## LinkedIn & Naukri

Jobwire does **not** log in, reuse cookies, or auto-apply. With an `APIFY_TOKEN`, **Pull the wire** runs cookie-free Apify Store actors (`mfrostbutter/linkedin-jobs-scraper` and `blackfalcondata/naukri-jobs-feed`) and stores matching Python roles. Without a token, those sources are skipped and you can still:

- Open LinkedIn / Naukri search pages
- Paste a listing URL + description into the ledger
- Draft screening answers, then apply on the site yourself

Apify MCP in Cursor Desktop can run the same actors interactively. This cloud agent cannot complete Apify OAuth; put the token in `.env.local` / Vercel env instead.

Daily Vercel Cron (Hobby allows once per day) refreshes the free public feeds. Pull the wire still collects on demand, including Apify when `APIFY_TOKEN` is set.

## Web app (Vercel)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://127.0.0.1:3000. Production uses the 1xlblaze Supabase project by default; override with `NEXT_PUBLIC_SUPABASE_*` in Vercel if you switch databases.

A daily Vercel Cron hits `GET /api/collect` (Hobby cannot schedule hourly jobs).

## Local Python CLI (optional)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src collect
python -m src serve
```

## Chrome helper

Load unpacked `extension/` against the running web origin if you want Suggest answer on public ATS forms. It never submits.
