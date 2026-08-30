from src.llm_solver import heuristic_answer, solve_question


def test_notice_period(config):
    assert heuristic_answer("What is your notice period?", config) == "15 days"


def test_docker_years(config):
    assert heuristic_answer("Years of experience in Docker?", config) == "3"


def test_expected_ctc(config):
    assert heuristic_answer("Expected CTC?", config) == "20 LPA"


def test_current_ctc(config):
    assert heuristic_answer("Current salary / CTC", config) == "14 LPA"


def test_sponsorship(config):
    assert heuristic_answer("Will you require visa sponsorship?", config) == "No"


def test_phone(config):
    assert "9876543210" in heuristic_answer("Phone number", config)


def test_unknown_qualitative_is_none(config):
    assert heuristic_answer("Why should we hire you for this platform role?", config) is None


async def test_template_fallback_for_why(config):
    result = await solve_question("Why this role?", config, job={"title": "Python Developer", "company": "Northwind"})
    assert result["source"] in {"template", "llm"}
    assert "Python" in result["answer"] or "python" in result["answer"].lower()
    assert len(result["answer"].split()) <= 90
