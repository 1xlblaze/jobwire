from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


ROOT = Path(__file__).resolve().parent.parent


class AgentSettings(BaseModel):
    polling_interval_minutes: int = 60
    lookback_hours: int = 24
    host: str = "0.0.0.0"
    port: int = 43141


class SearchSettings(BaseModel):
    keywords: list[str] = Field(default_factory=lambda: ["python"])
    title_hints: list[str] = Field(default_factory=list)
    sources: list[str] = Field(
        default_factory=lambda: [
            "remoteok",
            "remotive",
            "arbeitnow",
            "jobicy",
            "weworkremotely",
        ]
    )


class CandidateProfile(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone_country_code: str = "+91"
    phone_number: str
    location: str
    experience_years: int = 0
    notice_period_days: int = 30
    current_ctc_lpa: float | None = None
    expected_ctc_lpa: float | None = None
    education_degree: str = ""
    summary: str = ""
    skills: dict[str, int] = Field(default_factory=dict)
    github: str = ""
    linkedin: str = ""
    website: str = ""
    work_authorization: str = ""
    requires_sponsorship: bool = False
    willing_to_relocate: bool = False
    remote_preference: str = "Remote"
    employment_type: str = "Full-time"
    resume_path: str = "resume.txt"

    @field_validator("skills", mode="before")
    @classmethod
    def coerce_skills(cls, value: Any) -> dict[str, int]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return {str(k): int(v) for k, v in value.items()}
        if isinstance(value, list):
            return {str(item): 0 for item in value}
        raise TypeError("skills must be a mapping or list")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def phone(self) -> str:
        return f"{self.phone_country_code} {self.phone_number}".strip()


class LlmSettings(BaseModel):
    provider: str = "auto"
    model: str = ""
    max_words: int = 75


class AppConfig(BaseModel):
    agent: AgentSettings = Field(default_factory=AgentSettings)
    search: SearchSettings = Field(default_factory=SearchSettings)
    candidate: CandidateProfile
    llm: LlmSettings = Field(default_factory=LlmSettings)

    @property
    def resume_text(self) -> str:
        path = Path(self.candidate.resume_path)
        if not path.is_absolute():
            path = ROOT / path
        if path.exists():
            return path.read_text(encoding="utf-8")
        return self.candidate.summary


def load_config(path: str | Path | None = None) -> AppConfig:
    config_path = Path(path) if path else ROOT / "config.yaml"
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    return AppConfig.model_validate(raw)
