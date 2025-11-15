.PHONY: help install run dev clean format lint test

help:
	@echo "ACE-ADK Development Commands"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make run        - Run the application"
	@echo "  make dev        - Run with auto-reload"
	@echo "  make format     - Format code with ruff"
	@echo "  make lint       - Lint code with ruff"
	@echo "  make clean      - Remove cache files"
	@echo "  make test       - Run tests"
	@echo ""

install:
	uv sync

run:
	uv run main.py

dev:
	uv run uvicorn main:app --reload --host 0.0.0.0 --port 8080

format:
	uv run ruff format .

lint:
	uv run ruff check .

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type f -name "*.pyd" -delete 2>/dev/null || true

test:
	uv run pytest -v
