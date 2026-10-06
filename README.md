# Practicum EMR System

Electronic Medical Record (EMR) system built as our practicum project.

## Tech Stack

**Frontend**
- React + TypeScript + Vite
- Material UI (MUI)

**Backend**
- Python + FastAPI
- REST API

**Database**
- PostgreSQL
- SQLAlchemy
- Alembic

**Development & Testing**
- Docker Compose
- Pytest

**Deployment**
- Docker
- GitHub Actions
- Managed cloud services

## Project Structure

```text
practicum_emr_system/
├── frontend/
├── backend/
├── docker-compose.yml
├── .env
└── README.md
```

## First-Time Setup

Clone the repository and enter the project:

```bash
git clone https://github.com/Gerardos0/Practicum_EMR_System.git
cd practicum_emr_system
```

### Frontend

```bash
cd frontend
npm install
cd ..
```

### Backend

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

cd ..
```

> Windows users can activate the virtual environment with:
>
> `.venv\Scripts\activate`

## Run the Project

### 1. Start the Database

From the main `practicum_emr_system` folder:

```bash
docker compose up -d
```

### 2. Start the Backend

Open a terminal:

```bash
cd backend
source .venv/bin/activate
python -m app.scripts.seed
uvicorn app.main:app --reload
```

Demo sign-in: `daniel.reyes@miners.utep.edu` / `practicum-demo`

Backend:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 3. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Daily Start

Once you've completed the first-time setup, you only need:

**Terminal 1**

```bash
docker compose up -d

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2**

```bash
cd frontend
npm run dev
```

The API can also run in Docker. From the project folder:

```bash
docker compose --profile api up -d --build
docker compose exec api python -m app.scripts.seed
```

API:

```text
http://localhost:8000
```

Migrations run when the container starts.

## Deploy

### API on Render

In Render, New → Blueprint, and pick this repo. Set `SEED_DEMO_PASSWORD` when it asks.

After the first deploy, open the service shell and run:

```bash
python -m app.scripts.seed
```

Copy the service URL. The database is the smallest paid Postgres plan. The free web service sleeps when idle.

### Frontend on Vercel

Import the repo. Root directory is `frontend`. Add `VITE_API_URL` and set it to the Render URL, with no trailing slash.

`https://*.vercel.app` is allowed. For another domain, set `CORS_ORIGINS` on the Render service.

## Important

Do not commit `.env` files, passwords, API keys, or real patient information to the repository.
