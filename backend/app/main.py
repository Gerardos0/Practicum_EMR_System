# from fastapi import FastAPI

# app = FastAPI(
#     title="API",
#     version="1.0.0",
# )

# @app.get("/")
# def root():
#     return {"message": "API is running"}

# @app.get("/health")
# def health():
#     return {"status": "healthy"}

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers get included here as you build them, e.g.:
# from app.api.routes import auth
# app.include_router(auth.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {"message": "API is running"}


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))  # proves the DB connection actually works
    return {"status": "healthy", "database": "connected"}