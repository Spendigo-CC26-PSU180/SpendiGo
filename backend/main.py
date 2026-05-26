from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import auth_router, transactions_router, analytics_router, predict_router, chat_router, budget_router
from core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    Base.metadata.create_all(bind=engine)

    # Don't pre-load ML models - load lazily on first request
    # This prevents TensorFlow import issues from crashing the server
    print("Server starting... ML models will be loaded on first prediction request")

    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    lifespan=lifespan,
    title="Spendigo API",
    description="Personal Finance API untuk Gen Z Indonesia",
    version="1.0.0"
)

# CORS middleware - allow all origins for Railway deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(analytics_router)
app.include_router(predict_router)
app.include_router(chat_router)
app.include_router(budget_router)


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
