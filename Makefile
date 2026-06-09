.PHONY: install dev-backend dev-frontend start stop clean

## Install all dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

## Run the FastAPI backend (dev mode with hot-reload)
dev-backend:
	cd backend && venv/Scripts/uvicorn main:app --host 0.0.0.0 --port 8001 --reload

## Run the Vite / React frontend (dev mode)
dev-frontend:
	cd frontend && npm run dev

## Lint the frontend
lint-frontend:
	cd frontend && npm run lint

## Build the frontend for production
build-frontend:
	cd frontend && npm run build

## Remove Python and Node caches
clean:
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>NUL || true
	rm -rf frontend/dist 2>NUL || true
