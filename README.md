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

To run the standalone ADK runner (recommended for the quick loop with frontend):

```bash
# create & activate a venv, then install project deps (project may use poetry/requirements)
python3 -m venv .venv
source .venv/bin/activate
pip install -r ace_system/requirements.txt  # or use pyproject/poetry if present

# Start the ADK runner (serves web UI + API on http://localhost:8082)
python3 adk_runner.py
```

Notes:
- `adk_runner.py` configures CORS to allow common dev origins (including Vite 5173). If your frontend runs on a different host/port, add it to `allow_origins` in `adk_runner.py`.
- The runner uses `adk_agents/` as the agents directory. The `youtube_agent` package in that folder exposes `root_agent` and is discovered by ADK on startup.

### Inspect available apps and test endpoints

List registered apps (to discover the correct app id to call from the frontend):

```bash
curl http://localhost:8082/apps
```

Create a session (example):

```bash
curl -X POST "http://localhost:8082/apps/<app-id>/users/frontend-user/sessions" -H "Content-Type: application/json" -d '{}'
```

Send a message to the agent:

```bash
curl -X POST "http://localhost:8082/run" -H "Content-Type: application/json" -d '{"appName":"<app-id>","userId":"frontend-user","sessionId":"<session-id>","newMessage":{"parts":[{"text":"Who is the top Python channel?"}]}}'
```

## Configuring MCP servers (agent-tools)

Agents call external tools via ADK Toolsets (MCP). This project shows two places you may want to configure MCP endpoints and headers:

- `adk_agents/youtube_agent/agent.py` — the standalone youtube agent attaches an `MCPToolset` configured to `http://localhost:3001` by default and supports `MCP_EXTRA_HEADERS` to inject headers.
- `ace_system/agents/ace_agent/sub_agents/generator.py` — the ACE generator can be configured to use `StreamableHTTPConnectionParams` or other connection param classes to point at a different MCP endpoint (e.g., Cloudflare URL or remote dev MCP).

To add or change an MCP server for the standalone agent, edit `adk_agents/youtube_agent/agent.py` and change the `StreamableHTTPConnectionParams(url=...)` value, or provide `MCP_EXTRA_HEADERS` in your `.env`.

Example: using a remote MCP server

```py
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams

mcp_tools = MCPToolset(
	connection_params=StreamableHTTPConnectionParams(url="https://my-mcp.example.com"),
	require_confirmation=False,
)
```

If your MCP server needs custom headers (authorization, proxy tokens), put them in `.env` as a JSON string under `MCP_EXTRA_HEADERS` — ADK agent code will parse and use them when configured.

## Frontend — development & production

The frontend expects an ADK server and creates sessions + sends messages via the ADK HTTP API. Current defaults in the repo:

- `frontend/src/services/aceService.ts` points to `http://localhost:8082` and auto-discovers the app id by requesting `/apps`.

To run the frontend locally:

```bash
cd frontend
# install deps (npm or pnpm)
npm install
npm run dev
```

The Vite dev server typically runs at `http://localhost:5173`. `adk_runner.py` includes the Vite origins in its CORS allowlist, so the frontend can talk to ADK during development.

Production build & deployment

```bash
cd frontend
npm run build
# serve `dist` from any static hosting (Netlify, Vercel, S3 + CloudFront, nginx, etc.)
```

When deploying frontend and ADK separately, ensure the frontend's `aceService.baseUrl` (or environment-based replacement) points to the publicly reachable ADK host, and that ADK CORS allows your frontend origin.

## Running the original ACE system

If you prefer the original larger ACE runtime in `ace_system/`, you can run its main app (it may serve on a different port such as `8081`):

```bash
cd ace_system
source ../.venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

If you run ACE on `8081`, update the frontend `aceService.baseUrl` to match if you want to use that runtime.

## Deployment notes

- ADK app server: run via `uvicorn` or system service (systemd) for production. Point `get_fast_api_app(agents_dir=...)` to your deployed agents directory.
- Keep secrets out of the repo — use environment configuration or a secrets manager. If you must include temporary tokens for local testing, restrict them to `.env` and add `.env` to `.gitignore`.
- MCP endpoints: host them where your agent can reach them. If they require auth tokens, supply those via `MCP_EXTRA_HEADERS` or a secure credential provider.

Example systemd unit for the ADK runner (`/etc/systemd/system/adk-runner.service`):

```ini
[Unit]
Description=ADK Runner
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/Autonomous-Youtube-analysis-agent
EnvironmentFile=/path/to/Autonomous-Youtube-analysis-agent/.env
ExecStart=/path/to/venv/bin/python3 /path/to/Autonomous-Youtube-analysis-agent/adk_runner.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

- 401 from MCP server: Inspect the ADK logs — if the inspector succeeds but the agent fails with 401, copy the inspector's request headers into `MCP_EXTRA_HEADERS` in `.env` so the agent includes the same headers.
- "Context variable not found" KeyError: ensure instruction templates don't include required placeholders for variables that may be missing (use optional placeholders in templates when supported) or populate session state before running the instruction.
- ADK app discovery: if the frontend fails to find an app ID, inspect `GET /apps` and use the `id` shown there as `appName` in requests.
- Port collisions: if something is listening on `3001` and you need to free it, find and kill the process:

```bash
# find process listening on 3001
sudo lsof -iTCP:3001 -sTCP:LISTEN -Pn
# kill (example)
sudo kill <PID>
```

## Files of interest

- `adk_agents/youtube_agent/agent.py` — standalone youtube agent (root_agent) and MCPToolset configuration.
- `adk_runner.py` — small runner for ADK (uses `adk_agents/`, serves on 8082 by default).
- `ace_system/agents/ace_agent/sub_agents/generator.py` — ACE generator; where generator prompts and toolset wiring live for the ACE system.
- `frontend/src/services/aceService.ts` — frontend integration; creates sessions and posts messages to ADK.

## Next steps (suggested)

1. Start the ADK runner: `python3 adk_runner.py` (ensure `.env` includes any MCP headers you need).
2. Start the frontend: `cd frontend && npm install && npm run dev`.
3. Use the UI at the Vite URL (default `http://localhost:5173`) and check the ADK web UI at `http://localhost:8082`.

If you'd like, I can:

- Auto-patch the frontend to use an environment variable for the ADK base URL so you don't edit source during deploy.
- Add SSE streaming support to `aceService` for live agent events.
- Help you create a production-ready systemd + nginx configuration for the ADK server and the frontend.

---

If anything in your environment differs (different ports, hosted MCP), tell me the target URLs and I will provide exact patches and run commands.
