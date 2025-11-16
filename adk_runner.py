#!/usr/bin/env python3
"""Small runner to start ADK web API against a custom agents directory.

This starts the ADK FastAPI app using `get_fast_api_app` with `agents_dir` set
to `adk_agents` (project root/adk_agents). The web UI is enabled and the server
binds to port 8082 to avoid colliding with other ADK instances.

Run:
  python3 adk_runner.py

Then open: http://localhost:8082
"""
from __future__ import annotations

import logging
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

from google.adk.cli.fast_api import get_fast_api_app

# Agents directory relative to project root
AGENTS_DIR = "adk_agents"

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app: FastAPI = get_fast_api_app(agents_dir=AGENTS_DIR, web=True, reload_agents=True)

# Allow the common dev UI origin; adjust if your frontend runs elsewhere
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)



def main() -> None:
    logger.info("Starting ADK server using agents dir: %s", AGENTS_DIR)
    logger.info("Open the web UI at http://localhost:8082")
    uvicorn.run(app, host="0.0.0.0", port=8082)


if __name__ == "__main__":
    main()
