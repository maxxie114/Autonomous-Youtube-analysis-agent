# Autonomous YouTube Analysis Agent

An ADK-based agent suite that analyzes YouTube channels and videos. This repository contains:

- `ace_system/` — the original ACE agent system and generator sub-agents.
- `adk_agents/` — a lightweight, ADK-discoverable standalone `youtube_agent` (exporting `root_agent`).
- `frontend/` — React + Vite frontend for interacting with the agent.
- `adk_runner.py` — a small runner that starts the ADK FastAPI app against `adk_agents` (port 8082 by default).

This README provides a complete deployment and development guide: how to run the agent, wire MCP servers (tool endpoints), run the frontend, and common troubleshooting steps.

**Table of contents**

- Prerequisites
- Environment configuration
- Running the agent (development)
- Configuring MCP servers (agent-tools)
- Frontend (development & production)
- Deployment notes
- Troubleshooting

## Prerequisites

- Python 3.10+ (venv recommended)
- Node.js (16+) / npm or pnpm for frontend
- Local MCP server reachable by the agent (e.g. `http://localhost:3001`) or a remote MCP endpoint
- Optional: an ADK-compatible LLM API key (if using cloud models)

## Environment configuration

Copy or create a `.env` file in the project root with values your agents need. Example minimal `.env`:

```bash
GOOGLE_API_KEY=your-google-key
GENERATOR_MODEL=gemini-2.5-flash
SERVE_WEB_INTERFACE=true
RELOAD_AGENTS=true
# Optional: extra headers to include on MCP requests (JSON string)
# MCP_EXTRA_HEADERS={"authorization":"Bearer <token>","x-mcp-proxy-auth":"Bearer <token>","mcp-protocol-version":"2025-06-18"}
```

- The `MCP_EXTRA_HEADERS` env var is used by the standalone `adk_agents/youtube_agent/agent.py` to include extra request headers when calling the MCP server (useful if your MCP requires auth headers or custom proxy headers that the ADK inspector used).

## Running the agent (development)

This repository contains two ADK runtimes you can run during development:

- The original ACE system under `ace_system/` (run using its own entrypoint: `python3 ace_system/main.py`).
- A lightweight runner for the standalone agents in `adk_agents/` (`adk_runner.py`) which starts ADK on port `8082` and is convenient for frontend integration.

To run the ADK API server (recommended for the quick loop with frontend):

This project includes ADK agents under `adk_agents/`. Instead of using the local adk runner script, the ADK CLI provides a built-in API server you can run directly from that folder. The API server will serve the ADK HTTP API and developer UI (usually on port `8000`).

```bash
# create & activate a venv, then install project deps if needed
python3 -m venv .venv
source .venv/bin/activate
pip install -r ace_system/requirements.txt  # or use your project's pyproject/poetry workflow

# Start the ADK API server from the agents directory
cd adk_agents
adk api_server

# By default the API server listens on http://localhost:8000
```

Notes:
- The official `adk api_server` is the supported way to serve your ADK agents in development; it exposes the same API endpoints the `adk web` UI uses and is the one exercised by `test_adk.py` in this repo.
- If you previously used `adk_runner.py` it can still be used for some workflows, but this README and the frontend now expect the ADK API server started with `adk api_server` (default host `http://localhost:8000`).
- If your frontend runs on a different host/port, make sure the ADK API server CORS configuration allows your frontend origin.

### Inspect available apps and test endpoints

# Autonomous YouTube Analysis Agent

Lightweight ADK agents and a React frontend for exploring YouTube channel and video analysis workflows.

This repository contains:

- `adk_agents/` — ADK-discoverable agents (standalone `youtube_agent`).
- `agent-tools/` — MCP tool server (Node) used by agents for external tool calls.
- `frontend/` — React + Vite UI to interact with agents.
- `ace_system/` — legacy ACE agent system (kept for reference).

Quick links

- ADK API server (dev): `http://localhost:8000` (when started with `adk api_server`)
- Frontend dev: `http://localhost:5173`
- MCP / tools server (dev): `http://localhost:3001`

## Overview

This project demonstrates how to build ADK agents that call external MCP tools and surface results in a small React app. The recommended local development flow is:

1. Start the MCP tool server (`agent-tools`).
2. Start the ADK API server (run `adk api_server` from `adk_agents/`).
3. Start the frontend and interact with the agent UI.

## Requirements

- Python 3.10+ (for ADK agents)
- Node.js 16+ and npm/yarn/pnpm (for frontend and `agent-tools`)
- ADK CLI installed (for `adk api_server`)

## Environment

Create a top-level `.env` (do not commit secrets). Example:

```
GOOGLE_API_KEY=your-google-key
GENERATOR_MODEL=gemini-2.5-flash
MCP_EXTRA_HEADERS={}
```

- `MCP_EXTRA_HEADERS` (optional): JSON string with headers agents should include on MCP requests.

## Run locally

1) Start the MCP tool server

```bash
cd agent-tools
npm install
npm run dev
```

2) Start the ADK API server

```bash
cd adk_agents
adk api_server
```

This starts the ADK API server (default `http://localhost:8000`) which the frontend uses for sessions and streaming.

3) Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at `http://localhost:5173`.

## Useful ADK endpoints

- `GET /apps` — list registered apps
- `POST /apps/{app}/users/{user}/sessions/{session}` — create session
- `POST /run_sse` — send message and receive SSE streaming responses

See `test_adk.py` for a minimal example of creating a session and reading SSE `data:` frames.

## Frontend notes

- `frontend/src/services/aceService.ts` contains the ADK integration (session creation + `/run_sse` handling). In development the frontend proxies `/adk/*` to the ADK API server.
- Ensure ADK CORS allows your frontend origin (e.g., `http://localhost:5173`).

## Deployment guidance

- Frontend: build with `npm run build` and host the static `dist` output on any static host.
- ADK API server: run with `adk api_server` or serve with `uvicorn` behind a reverse proxy (nginx) in production.
- MCP/tool server: deploy the Node service where the ADK agent can reach it; secure with TLS and auth.

Example systemd snippet to run `adk api_server` via a shell script or venv-managed command is appropriate for production.

## Troubleshooting

- No app ID: `GET /apps` to discover the `id` to use when creating sessions.
- SSE method not allowed: use `POST /run_sse` for streaming (ADK requires POST for SSE streams).
- CORS problems: add your frontend origin to ADK CORS configuration.
- MCP auth failures: add necessary headers to `MCP_EXTRA_HEADERS`.

## Contributing

1. Fork, branch, implement, and open a PR.
2. Include a brief test or manual verification step in the PR description.

## License

- MIT License