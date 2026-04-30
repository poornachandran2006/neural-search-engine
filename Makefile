.PHONY: dev down logs ps build shell-backend shell-db health

dev:
	docker compose -f infra/docker-compose.dev.yml up --build -d

down:
	docker compose -f infra/docker-compose.dev.yml down

down-volumes:
	docker compose -f infra/docker-compose.dev.yml down -v

logs:
	docker compose -f infra/docker-compose.dev.yml logs -f

logs-backend:
	docker compose -f infra/docker-compose.dev.yml logs -f backend

ps:
	docker compose -f infra/docker-compose.dev.yml ps

build:
	docker compose -f infra/docker-compose.dev.yml build --no-cache

shell-backend:
	docker compose -f infra/docker-compose.dev.yml exec backend bash

shell-db:
	docker compose -f infra/docker-compose.dev.yml exec postgres psql -U neural -d neural_search

health:
	curl -s http://localhost:8000/health | python -m json.tool