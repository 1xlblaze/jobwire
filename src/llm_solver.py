from __future__ import annotations

import os
import re
from typing import Any

import httpx

from src.config_loader import AppConfig, CandidateProfile


SYSTEM_PROMPT = """You are an executive candidate assistant drafting answers for the candidate.
Given the candidate's structured resume, the job listing title, and the recruiter's specific question:
1. Answer concisely, honestly, and directly.
2. If asking for years of experience with a named technology, return only an integer matching the candidate's experience.
3. If asking for a short description or cover note, keep it professional, under {max_words} words, highlighting relevant achievements.
4. Output strictly the answer text with no surrounding markdown, tags, or meta-commentary.
"""


YES_NO_TRUE = re.compile(
    r"\b(yes|true|authorized|eligible|comfortable|willing|able)\b",
    re.I,
)


def _blob(text: str) -> str:
    return (text or "").strip().lower()


def years_for_skill(profile: CandidateProfile, skill: str) -> int | None:
    needle = skill.lower()
    for name, years in profile.skills.items():
        if name.lower() == needle:
            return int(years)
    for name, years in profile.skills.items():
        if needle in name.lower() or name.lower() in needle:
            return int(years)
    return None


def detect_named_skill(question: str, profile: CandidateProfile) -> str | None:
    q = _blob(question)
    ranked = sorted(profile.skills.keys(), key=len, reverse=True)
    for skill in ranked:
        if re.search(rf"\b{re.escape(skill.lower())}\b", q):
            return skill
    return None


def heuristic_answer(question: str, config: AppConfig, job: dict[str, Any] | None = None) -> str | None:
    """Return a deterministic answer for common screening fields, or None."""
    profile = config.candidate
    q = _blob(question)
    if not q:
        return None

    skill = detect_named_skill(question, profile)
    if skill and re.search(r"\b(years?|yrs?|experience|exp)\b", q):
        years = years_for_skill(profile, skill)
        if years is not None:
            return str(years)

    if re.search(r"notice\s*period|how soon|start date|joining|availability", q):
        return f"{profile.notice_period_days} days"

    if re.search(r"current (ctc|salary|comp|pay)|present (ctc|salary)", q):
        if profile.current_ctc_lpa is not None:
            return f"{profile.current_ctc_lpa:g} LPA"
        return None

    if re.search(r"expected (ctc|salary|comp|pay)|salary expectation|desired (salary|ctc)", q):
        if profile.expected_ctc_lpa is not None:
            return f"{profile.expected_ctc_lpa:g} LPA"
        return None

    if re.search(r"\b(phone|mobile|cell)\b", q) and "country" not in q:
        return profile.phone

    if "email" in q:
        return profile.email

    if re.search(r"full name|first name|last name|your name", q):
        if "first" in q:
            return profile.first_name
        if "last" in q or "surname" in q:
            return profile.last_name
        return profile.full_name

    if re.search(r"where do you live|current location|city|based in", q):
        return profile.location

    if re.search(r"total experience|years of experience|how many years", q) and not skill:
        return str(profile.experience_years)

    if re.search(r"education|degree|qualification|university", q):
        return profile.education_degree

    if re.search(r"github", q):
        return profile.github
    if re.search(r"linkedin", q):
        return profile.linkedin
    if re.search(r"portfolio|personal site|website", q):
        return profile.website

    if re.search(r"sponsor|visa|work (auth|permit|authorization)|authorized to work", q):
        if re.search(r"sponsor", q):
            return "No" if not profile.requires_sponsorship else "Yes"
        return profile.work_authorization or ("Yes" if not profile.requires_sponsorship else "No")

    if re.search(r"relocat", q):
        return "Yes" if profile.willing_to_relocate else "No"

    if re.search(r"\bremote\b|\bhybrid\b|\bonsite\b|\bon-site\b", q) and re.search(
        r"prefer|willing|ok with|open to|work from", q
    ):
        return profile.remote_preference

    if re.search(r"full[- ]?time|part[- ]?time|contract|employment type", q):
        return profile.employment_type

    if re.search(r"^(yes|no)\b|are you (yes|no)|select yes", q):
        return "Yes"

    return None


def _template_qualitative(question: str, config: AppConfig, job: dict[str, Any] | None) -> str:
    profile = config.candidate
    title = (job or {}).get("title") or "this role"
    company = (job or {}).get("company") or "your team"
    skill_line = ", ".join(list(profile.skills.keys())[:6])
    return (
        f"I am a {profile.experience_years}-year Python backend engineer interested in {title} "
        f"at {company}. I have shipped production services with {skill_line}. "
        f"{profile.summary.strip()} Happy to walk through relevant work in a screen."
    )


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def _clip_words(text: str, max_words: int) -> str:
    words = re.findall(r"\S+", text.strip())
    if len(words) <= max_words:
        return text.strip()
    return " ".join(words[:max_words]).rstrip(",;") + "."


async def _openai_answer(prompt: str, system: str, model: str | None) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    use_model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": use_model,
                "temperature": 0.3,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            },
        )
        response.raise_for_status()
        data = response.json()
        return str(data["choices"][0]["message"]["content"]).strip()


async def _gemini_answer(prompt: str, system: str, model: str | None) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    use_model = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{use_model}:generateContent"
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            params={"key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3},
            },
        )
        response.raise_for_status()
        data = response.json()
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(part.get("text", "") for part in parts).strip()


def _choose_provider(config: AppConfig) -> str:
    requested = (config.llm.provider or "auto").lower()
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    if requested in {"none", "off", "heuristic"}:
        return "none"
    if requested == "openai" and has_openai:
        return "openai"
    if requested == "gemini" and has_gemini:
        return "gemini"
    if requested == "auto":
        if has_openai:
            return "openai"
        if has_gemini:
            return "gemini"
        return "none"
    return "none"


def build_user_prompt(
    question: str,
    config: AppConfig,
    job: dict[str, Any] | None = None,
) -> str:
    job = job or {}
    profile = config.candidate
    skill_lines = "\n".join(f"- {name}: {years} years" for name, years in profile.skills.items())
    return f"""CANDIDATE
Name: {profile.full_name}
Location: {profile.location}
Experience: {profile.experience_years} years
Notice period: {profile.notice_period_days} days
Current CTC: {profile.current_ctc_lpa} LPA
Expected CTC: {profile.expected_ctc_lpa} LPA
Education: {profile.education_degree}
Work authorization: {profile.work_authorization}
Sponsorship required: {profile.requires_sponsorship}
Relocate: {profile.willing_to_relocate}
Remote preference: {profile.remote_preference}
Skills (years):
{skill_lines}

RESUME
{config.resume_text}

JOB
Title: {job.get('title') or '(not provided)'}
Company: {job.get('company') or '(not provided)'}
Location: {job.get('location') or '(not provided)'}
Description:
{(job.get('description') or '')[:4000]}

QUESTION
{question}
"""


async def solve_question(
    question: str,
    config: AppConfig,
    job: dict[str, Any] | None = None,
    force_llm: bool = False,
) -> dict[str, Any]:
    question = (question or "").strip()
    if not question:
        raise ValueError("question is required")

    heuristic = heuristic_answer(question, config, job)
    provider = _choose_provider(config)
    system = SYSTEM_PROMPT.format(max_words=config.llm.max_words)

    if heuristic and not force_llm:
        return {
            "answer": heuristic,
            "source": "heuristic",
            "provider": provider,
        }

    if provider == "none":
        draft = heuristic or _clip_words(
            _template_qualitative(question, config, job), config.llm.max_words
        )
        return {"answer": draft, "source": "template", "provider": "none"}

    prompt = build_user_prompt(question, config, job)
    try:
        if provider == "openai":
            text = await _openai_answer(prompt, system, config.llm.model or None)
        else:
            text = await _gemini_answer(prompt, system, config.llm.model or None)
        text = text.strip().strip('"')
        if _word_count(text) > config.llm.max_words + 15:
            text = _clip_words(text, config.llm.max_words)
        return {"answer": text, "source": "llm", "provider": provider}
    except Exception as exc:  # noqa: BLE001 — fall back rather than fail the helper
        fallback = heuristic or _clip_words(
            _template_qualitative(question, config, job), config.llm.max_words
        )
        return {
            "answer": fallback,
            "source": "template",
            "provider": provider,
            "error": str(exc),
        }
