.PHONY: build-frontend-image build-backend-image smoke-test _start-frontend clean-smoke-test clean-integration-test test-module help

FRONTEND_IMAGE ?= frontend-smoke-local
BACKEND_IMAGE ?= backend-smoke-local
FRONTEND_CONTAINER := frontend-smoke-local
BACKEND_CONTAINER := backend-smoke-local
PLAYWRIGHT_IMAGE := mcr.microsoft.com/playwright:v1.60.0
BACKEND_PORT := 3001
FRONTEND_PORT := 8080
WORKSPACE := /workspace

# Used for configuring container-based commands
CONTAINER_RUNTIME ?= $(shell basename $$(command -v podman 2>/dev/null) || echo "docker")
OS := $(shell uname -s)

# Environment variables for Playwright container
# PLAYWRIGHT_BROWSERS_PATH: Use pre-installed browsers in the container
# instead of downloading them at runtime (saves time, ensures consistency)
COMMON_ENV := \
	-e HOME=/tmp \
	-e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
	-e XDG_CACHE_HOME=/tmp/.cache \
	-e npm_config_cache=/tmp/.npm \
	-e BASE_URL=http://localhost:$(FRONTEND_PORT)

CONTAINER_FLAGS := --rm -t \
	--network host \
	-v $(CURDIR):$(WORKSPACE):z \
	-w $(WORKSPACE)

# Smoke tests setup command: install dependencies in container
# Note: npm ci inherently replaces node_modules with Linux packages via bind mount
SETUP_CMD := mkdir -p /tmp/.cache /tmp/.npm && npm ci --silent

# Helper function to start a frontend or backend container for smoke testing,
# then wait for the health check to pass
define start-container
	@echo "Starting $(1) container..."
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		$(CONTAINER_RUNTIME) run -d \
			-p $(3):$(3) \
			$(5) \
			--name $(1) \
			$(2) > /dev/null; \
	else \
		$(CONTAINER_RUNTIME) run -d \
			--network host \
			$(5) \
			--name $(1) \
			$(2) > /dev/null; \
	fi
	@echo "Waiting for $(1) to be ready..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if curl -sf http://localhost:$(3)$(4) > /dev/null 2>&1; then \
			echo "$(1) is ready (attempt $$i)"; \
			break; \
		fi; \
		if [ $$i -eq 10 ]; then \
			echo "$(1) failed to start after 10 attempts"; \
			$(MAKE) clean-smoke-test; \
			exit 1; \
		fi; \
		sleep 2; \
	done
endef

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}'

build-frontend-image:
	@echo "Building frontend container image..."
	@$(CONTAINER_RUNTIME) build -f deploy/frontend.Dockerfile -t $(FRONTEND_IMAGE) .

build-backend-image:
	@echo "Building backend container image..."
	@$(CONTAINER_RUNTIME) build -f deploy/backend.Dockerfile -t $(BACKEND_IMAGE) .

# ========================================
# Smoke Tests
# ========================================
smoke-test:
	# Start backend container in demo mode (uses fixture data, no credentials needed)
	$(call start-container,$(BACKEND_CONTAINER),$(BACKEND_IMAGE),$(BACKEND_PORT),/api/healthz,-e DEMO_MODE=true)
	# Start frontend (macOS/Podman uses gateway IP, others use localhost)
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		BACKEND_HOST=$$($(CONTAINER_RUNTIME) run --rm alpine ip route | awk '/default/ {print $$3}'); \
		$(MAKE) -s _start-frontend BACKEND_HOST=$$BACKEND_HOST; \
	else \
		$(MAKE) -s _start-frontend BACKEND_HOST=127.0.0.1; \
	fi
	# Run Playwright tests in container (no local browser installation needed)
	@echo "Running Playwright smoke tests in container..."
	$(CONTAINER_RUNTIME) run $(CONTAINER_FLAGS) $(COMMON_ENV) \
		$(PLAYWRIGHT_IMAGE) \
		bash -c "$(SETUP_CMD) && npm run test:smoke" || \
		(EXIT_CODE=$$?; $(MAKE) clean-smoke-test; exit $$EXIT_CODE)
	@echo "All smoke tests passed!"
	@$(MAKE) clean-smoke-test

# Helper target to start frontend with dynamic BACKEND_HOST
# Note: This is a target (not a function) because calling $(call start-container,...)
# on a backslash-continued line causes Makefile escaping issues with @ and $$ symbols
_start-frontend:
	$(call start-container,$(FRONTEND_CONTAINER),$(FRONTEND_IMAGE),$(FRONTEND_PORT),/healthz,--add-host=backend:$(BACKEND_HOST))

# ========================================
# Integration Tests
# ========================================
# Generic target for running module-specific integration tests
# Usage: make test-module MODULE=ai-impact
# This starts the app containers and runs Playwright tests tagged with @<MODULE>
test-module:
	@if [ -z "$(MODULE)" ]; then \
		echo "ERROR: MODULE variable is required"; \
		echo "Usage: make test-module MODULE=ai-impact"; \
		exit 1; \
	fi
	@echo "Running integration tests for module: $(MODULE)"
	# Start backend container
	$(call start-container,$(BACKEND_CONTAINER),$(BACKEND_IMAGE),$(BACKEND_PORT),/api/healthz,-e DEMO_MODE=true)
	# Start frontend container
	@if [ "$(CONTAINER_RUNTIME)" = "podman" ] && [ "$(OS)" = "Darwin" ]; then \
		BACKEND_HOST=$$($(CONTAINER_RUNTIME) run --rm alpine ip route | awk '/default/ {print $$3}'); \
		$(MAKE) -s _start-frontend BACKEND_HOST=$$BACKEND_HOST; \
	else \
		$(MAKE) -s _start-frontend BACKEND_HOST=127.0.0.1; \
	fi
	# Run integration tests filtered by module tag
	@echo "Running Playwright tests tagged with @$(MODULE)..."
	$(CONTAINER_RUNTIME) run $(CONTAINER_FLAGS) $(COMMON_ENV) \
		$(PLAYWRIGHT_IMAGE) \
		bash -c "$(SETUP_CMD) && npx playwright test --grep @$(MODULE)" || \
		(EXIT_CODE=$$?; $(MAKE) clean-integration-test; exit $$EXIT_CODE)
	@echo "Integration tests for $(MODULE) passed!"
	@$(MAKE) clean-integration-test

# ========================================
# Clean targets
# ========================================
clean-smoke-test:
	@echo "Cleaning up..."
	@$(CONTAINER_RUNTIME) stop $(FRONTEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) rm $(FRONTEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) stop $(BACKEND_CONTAINER) > /dev/null 2>&1 || true
	@$(CONTAINER_RUNTIME) rm $(BACKEND_CONTAINER) > /dev/null 2>&1 || true
	@echo "Cleanup complete"

# Alias for integration test cleanup (uses same containers as smoke tests for now)
clean-integration-test: clean-smoke-test
