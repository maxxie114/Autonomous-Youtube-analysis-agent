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

List registered apps (to discover the correct app id to call from the frontend):

```bash
curl http://localhost:8000/apps
```

Create a session (example) — this repo's `test_adk.py` demonstrates creating a session that includes an explicit session id in the path:

```bash
# Using an explicit session id in the path (test_adk.py style)
curl -X POST "http://localhost:8000/apps/<app-id>/users/<user-id>/sessions/<session-id>" -H "Content-Type: application/json" -d '{}'
```

Send a message to the agent (streaming):

```bash
curl -N -X POST "http://localhost:8000/run_sse" \
	-H "Content-Type: application/json" \
	-d '{
		"appName": "<app-id>",
		"userId": "<user-id>",
		"sessionId": "<session-id>",
		"newMessage": {
			"role": "user",
			"parts": [{ "text": "Who is the top Python channel?" }]
		},
		"streaming": true
	}'
```

The server will stream Server-Sent Events (SSE) prefixed with `data:` lines; see `test_adk.py` for an example script that connects and prints those `data:` lines.

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

## Running MCP, frontend, and ADK together

This project contains three separate services you commonly run together during development:

- MCP / tools server: `agent-tools` (Node)
- Frontend: `frontend` (Vite / React)
- ADK agent runtime: `adk_runner.py` (Python / ADK)

Recommended startup order:

1. Start the MCP / tools server so the tools are available to the agent.
2. Start the ADK runner so agents can call the MCP endpoints.
3. Start the frontend to connect to the running ADK API.

Individual start commands

- Start the MCP tools server (from project root):

```bash
cd agent-tools
npm install
npm run dev
```

- Start the ADK runner (from project root):

```bash
# ensure your Python venv is activated and ADK deps are installed
python3 -m venv .venv
source .venv/bin/activate
pip install -r ace_system/requirements.txt
python3 adk_runner.py
```

- Start the frontend (from project root):

```bash
cd frontend
npm install
npm run dev
```

Quick combined startup options

Option A — tmux (recommended for local dev):

```bash
# create a tmux session and start each service in its own pane
tmux new-session -d -s ytagent \
	"cd agent-tools && npm run dev" \; \
split-window -h "source .venv/bin/activate && python3 adk_runner.py" \; \
split-window -v "cd frontend && npm run dev" \; \
attach
```

Option B — `concurrently` (single terminal, requires globally installed package or npm script):

```bash
# from project root (install concurrently first: npm i -g concurrently)
concurrently "cd agent-tools && npm run dev" "source .venv/bin/activate && python3 adk_runner.py" "cd frontend && npm run dev"
```

Option C — simple background script (example `start-all.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load project-level .env if present
if [ -f .env ]; then
	# This exports variables like GOOGLE_API_KEY and MCP_EXTRA_HEADERS for child processes
	set -o allexport; source .env; set +o allexport
fi

# Start agent-tools
(cd agent-tools && npm install && npm run dev) &
PID_AGENT_TOOLS=$!

# Start ADK runner (assumes venv already created)
(source .venv/bin/activate && python3 adk_runner.py) &
PID_ADK=$!

# Start frontend
(cd frontend && npm install && npm run dev) &
PID_FRONTEND=$!

echo "Started agent-tools($PID_AGENT_TOOLS) adk($PID_ADK) frontend($PID_FRONTEND)"
wait
```

Notes:
- These examples are for local development convenience only. For production deployments use dedicated process managers (systemd, docker-compose, Kubernetes, etc.).

## `.env` files and precedence

This repository contains multiple `.env` files in sub-projects and you may also have a top-level `.env`. Here are recommended conventions:

- **Top-level `.env` (project root):** place shared/secrets that apply to all services (e.g., `GOOGLE_API_KEY`, `GENERATOR_MODEL`, `MCP_EXTRA_HEADERS` if tool headers are shared).
- **Subproject `.env` (optional):** each subproject (e.g., `agent-tools/`, `frontend/`, `ace_system/`) may have its own `.env` for local overrides (ports, local-only flags). Treat subproject `.env` as *overrides* for values in the top-level `.env`.

How to load envs consistently:

- When running a service from its directory (e.g., `cd frontend && npm run dev`), that process may load `frontend/.env` automatically (Vite does) or you can explicitly source the top-level `.env` first:

```bash
# from project root
set -o allexport; source .env; set +o allexport
cd frontend && npm run dev
```

- For Python processes (ADK runner), ensure your shell environment contains the variables before starting the runner (see the `start-all.sh` example above). The ADK runner will use the environment variables available in its process.

Security note: do not commit `.env` files with secrets to git. Add `.env` to `.gitignore` and use secret managers for production.


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
