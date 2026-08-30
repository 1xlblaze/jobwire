export const PROFILE = {
  firstName: "Alex",
  lastName: "Rao",
  fullName: "Alex Rao",
  email: "alex.rao@example.com",
  phone: "+91 9876543210",
  location: "Bangalore, India",
  experienceYears: 4,
  noticePeriodDays: 15,
  currentCtcLpa: 14,
  expectedCtcLpa: 20,
  education: "Bachelor of Technology in Computer Science",
  summary:
    "Backend engineer focused on Python APIs, data stores, and cloud-native delivery. Recently led a FastAPI platform that cut p95 latency 40% and shipped Kubernetes-based deploys on AWS.",
  skills: {
    Python: 4,
    FastAPI: 3,
    Django: 3,
    PostgreSQL: 3,
    Docker: 3,
    Kubernetes: 2,
    AWS: 3,
    Redis: 2,
    pytest: 3,
  } as Record<string, number>,
  github: "https://github.com/example",
  linkedin: "https://www.linkedin.com/in/example",
  website: "https://example.dev",
  workAuthorization: "Yes — authorized to work in India.",
  requiresSponsorship: false,
  willingToRelocate: false,
  remotePreference: "Remote-first; hybrid in Bangalore is fine.",
  employmentType: "Full-time",
  resume: `Alex Rao
Backend Engineer · Bangalore, India
alex.rao@example.com · +91 98765 43210

SUMMARY
Python backend engineer with 4 years building API platforms, data pipelines,
and production services on AWS.

EXPERIENCE
Senior Backend Engineer — Northwind Labs (2023–present)
- Led a FastAPI service mesh serving 12M requests/day; dropped p95 latency 40%.
- Introduced contract tests and pytest fixtures that cut regression escapes in half.

Backend Engineer — Deccan Systems (2021–2023)
- Shipped Django REST modules for inventory and payments used by 80+ operators.
- Containerized legacy workers with Docker and moved nightly jobs onto AWS batch.

SKILLS
Python, FastAPI, Django, PostgreSQL, Redis, Docker, Kubernetes, AWS, pytest

EDUCATION
B.Tech, Computer Science — 2021`,
};
