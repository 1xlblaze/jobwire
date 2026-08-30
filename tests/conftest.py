from pathlib import Path

import pytest

from src.config_loader import load_config
from src.db import JobStore
from src.web import create_app


@pytest.fixture
def config():
    return load_config(Path(__file__).resolve().parent.parent / "config.yaml")


@pytest.fixture
def store(tmp_path):
    return JobStore(tmp_path / "jobs.db")


@pytest.fixture
def app(config, store):
    return create_app(config, store, seed_on_start=False)


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client
