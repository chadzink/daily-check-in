# DailyCheckIn Makefile
# Provides build automation and development workflows matching README and PLAN-001.

SHELL := /bin/sh

# Configuration variables
PORT ?= 8080
FIRESTORE_EMULATOR_HOST ?= localhost:8085
FIREBASE_AUTH_EMULATOR_HOST ?= localhost:9099
IMAGE_NAME ?= dailycheckin:latest
BIN_DIR ?= bin
BIN_NAME ?= dailycheckin

.PHONY: all help dev dev-backend dev-frontend build build-frontend build-backend test test-backend test-frontend emulators emulators-down clean deps docker-build

all: help

help: ## Display available make targets
	@echo "DailyCheckIn - Available Make Targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

deps: ## Install backend and frontend dependencies
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Downloading Go modules..."
	go mod download

emulators: ## Start Firebase Local Emulators in background via Docker Compose
	@echo "Starting Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000)..."
	docker compose up -d

emulators-down: ## Stop Firebase Local Emulators
	@echo "Stopping Firebase Local Emulators..."
	docker compose down

dev: ## Run full-stack development (Go backend + Vite dev server concurrently)
	@echo "Starting DailyCheckIn full-stack development..."
	@echo "  Backend:  http://localhost:$(PORT) (API: /api/health)"
	@echo "  Frontend: http://localhost:5173"
	@trap 'kill 0' EXIT INT TERM; \
	(FIRESTORE_EMULATOR_HOST="$(FIRESTORE_EMULATOR_HOST)" \
	 FIREBASE_AUTH_EMULATOR_HOST="$(FIREBASE_AUTH_EMULATOR_HOST)" \
	 PORT="$(PORT)" \
	 go run ./cmd/server) & \
	(cd frontend && npm run dev) & \
	wait

dev-backend: ## Run Go Echo backend server only with emulator environment variables
	@echo "Starting Go Echo backend server on port $(PORT)..."
	FIRESTORE_EMULATOR_HOST="$(FIRESTORE_EMULATOR_HOST)" \
	FIREBASE_AUTH_EMULATOR_HOST="$(FIREBASE_AUTH_EMULATOR_HOST)" \
	PORT="$(PORT)" \
	go run ./cmd/server

dev-frontend: ## Run Vite frontend dev server only
	@echo "Starting Vite frontend dev server..."
	cd frontend && npm run dev

build-frontend: ## Build production Vite React SPA bundle (output to frontend/dist)
	@echo "Building frontend production bundle..."
	cd frontend && npm run build

build-backend: ## Compile Go server binary embedding static assets
	@echo "Compiling Go binary ($(BIN_DIR)/$(BIN_NAME))..."
	mkdir -p $(BIN_DIR)
	go build -ldflags="-s -w" -o $(BIN_DIR)/$(BIN_NAME) ./cmd/server

build: build-frontend build-backend ## Build single production binary with embedded frontend assets
	@echo "Build complete: $(BIN_DIR)/$(BIN_NAME)"

test-backend: ## Run backend unit and integration tests
	@echo "Running backend Go tests..."
	go test -v ./...

test-frontend: ## Run frontend Vitest test suite
	@echo "Running frontend Vitest tests..."
	cd frontend && npm test

test: test-backend test-frontend ## Run all test suites (backend + frontend)

docker-build: ## Build multi-stage production Docker container image
	@echo "Building production Docker image: $(IMAGE_NAME)..."
	docker build -t $(IMAGE_NAME) .

clean: ## Clean build artifacts and distribution directories
	@echo "Cleaning build artifacts..."
	rm -rf $(BIN_DIR)
	rm -rf frontend/dist
