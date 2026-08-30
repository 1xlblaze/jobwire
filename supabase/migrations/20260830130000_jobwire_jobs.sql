-- Jobwire public tables (applied on existing Artolio project kqolyvmwcsqilnakuewt)

CREATE TABLE IF NOT EXISTS public.jobwire_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  company text,
  location text,
  url text,
  description text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  posted_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS public.jobwire_fetch_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  error text
);

ALTER TABLE public.jobwire_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobwire_fetch_runs ENABLE ROW LEVEL SECURITY;
