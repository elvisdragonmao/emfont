set dotenv-load := true

compose := "docker compose -f docker-compose.dev.yml"

default:
	@just --list

# Start Postgres and Redis, apply existing migrations, and run the Go API container.
up:
	{{compose}} up -d --wait postgres redis
	DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$POSTGRES_PORT/$POSTGRES_DB" pnpm db:migrate
	{{compose}} up -d --build go-server
	@echo "emfont Go API is up at http://localhost:3001"

# Stop the Go API and the Postgres/Redis services started by `just up`.
down:
	{{compose}} stop go-server postgres redis
	@echo "emfont Go API, Postgres, and Redis are stopped"

alias server-dev := up

# Follow Go API container logs.
server-logs:
	{{compose}} logs -f go-server

# Build the Go API server.
server-build:
	cd server && go build -o bin/server ./cmd/server

# Test the Go module.
server-test:
	cd server && go test ./...
