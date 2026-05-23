from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import auth_router, transactions_router, analytics_router, predict_router, chat_router
from core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    lifespan=lifespan,
    title="Spendigo API",
    description="Personal Finance API untuk Gen Z Indonesia",
    version="1.0.0"
)

# CORS origins
cors_origins = [
    "http://localhost:4321",  # Astro dev server
    "http://localhost:3000",
    "http://127.0.0.1:4321",
    "http://127.0.0.1:3000",
    "https://spendigo-frontend.up.railway.app",  # Railway frontend
]

# Add frontend URL from environment (Railway)
if settings.FRONTEND_URL:
    cors_origins.append(settings.FRONTEND_URL)
    # Also add without trailing slash
    cors_origins.append(settings.FRONTEND_URL.rstrip("/"))

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(analytics_router)
app.include_router(predict_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {
        "message": "Spendigo API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
