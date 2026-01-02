"""FastAPI main application"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import appliances, health, manuals
from app.config import settings

# Create FastAPI app
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Backend API for Manual Agent App - Appliance manual management with AI",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(
    appliances.router,
    prefix=settings.api_v1_prefix,
)
app.include_router(
    manuals.router,
    prefix=settings.api_v1_prefix,
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Manual Agent Backend API",
        "version": settings.version,
        "docs": "/docs",
    }
