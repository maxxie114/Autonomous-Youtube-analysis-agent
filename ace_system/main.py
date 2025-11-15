import logging

import uvicorn
from fastapi import FastAPI
from google.adk.cli.fast_api import get_fast_api_app

from config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

config = Config()

app: FastAPI = get_fast_api_app(
    agents_dir=config.agent_dir,
    web=config.serve_web_interface,
    reload_agents=config.reload_agents,
)


def main():
    """Start the FastAPI server."""
    logger.info("Starting ACE-ADK server on http://0.0.0.0:8080")
    logger.info(f"Agent directory: {config.agent_dir}")
    logger.info(f"Web interface: {config.serve_web_interface}")
    logger.info(f"Reload agents: {config.reload_agents}")
    
    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
