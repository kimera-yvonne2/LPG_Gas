.PHONY: bootstrap up down logs test lint format migrations-check

bootstrap:
	copy .env.example .env
	docker compose build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose run --rm frontend npm test
	docker compose run --rm backend pytest

lint:
	docker compose run --rm frontend npm run lint
	docker compose run --rm backend ruff check .

format:
	docker compose run --rm backend black .
	docker compose run --rm backend isort .

migrations-check:
	docker compose run --rm backend python manage.py makemigrations --check --dry-run
