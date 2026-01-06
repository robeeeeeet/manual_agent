"""FastAPI main application"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    appliances,
    cron,
    health,
    manuals,
    notifications,
    push_subscriptions,
    qa,  # Import separately to avoid linter removal
    users,
)
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:     %(name)s - %(message)s",
)
# Set our service loggers to INFO level
logging.getLogger("app.services.manual_search").setLevel(logging.INFO)

# Logger for main module
main_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Sets up thread pool executor for blocking I/O operations (HTTP requests, LLM calls).
    This allows asyncio.to_thread() to use a properly sized thread pool.
    """
    # Create thread pool executor with configured size
    executor = ThreadPoolExecutor(
        max_workers=settings.max_thread_pool_workers,
        thread_name_prefix="manual_search_",
    )

    # Set as default executor for asyncio.to_thread()
    loop = asyncio.get_running_loop()
    loop.set_default_executor(executor)

    main_logger.info(
        f"Started with thread pool size: {settings.max_thread_pool_workers}, "
        f"max concurrent searches: {settings.max_concurrent_searches}"
    )

    yield

    # Cleanup: shutdown executor
    executor.shutdown(wait=True)
    main_logger.info("Thread pool executor shut down")


# Create FastAPI app
app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Backend API for Manual Agent App - Appliance manual management with AI",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
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
app.include_router(
    push_subscriptions.router,
    prefix=settings.api_v1_prefix,
)
app.include_router(
    notifications.router,
    prefix=settings.api_v1_prefix,
)
app.include_router(
    cron.router,
    prefix=settings.api_v1_prefix,
)
app.include_router(
    users.router,
    prefix=settings.api_v1_prefix,
)
app.include_router(
    qa.router,
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
