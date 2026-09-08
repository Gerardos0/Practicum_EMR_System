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
- Vitest + React Testing Library
- Playwright

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
uvicorn app.main:app --reload
```

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

## Important

Do not commit `.env` files, passwords, API keys, or real patient information to the repository.
