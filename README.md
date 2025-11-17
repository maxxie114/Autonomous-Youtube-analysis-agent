# Autonomous YouTube Analysis Agent

AI-driven YouTube channel & video analysis with ADK agents, FrontMCP tools, and a React frontend.

Demo video (click to play):

[![Autonomous YouTube Analysis Agent Demo](https://img.youtube.com/vi/yaUn067vt-M/hqdefault.jpg)](https://youtu.be/yaUn067vt-M)

## Quick Links
- ADK API server (dev): `http://localhost:8000`
- Frontend (dev): `http://localhost:5173`
- MCP tools server (dev): `http://localhost:3001`
- Demo video (YouTube): https://youtu.be/yaUn067vt-M

## Overview
This hackathon project showcases autonomous workflows for searching channels, analyzing videos, generating thumbnails & cover images, and optionally uploading content. It combines:
- `adk_agents/` – ADK-discoverable `youtube_agent`
- `agent-tools/` – Node MCP server exposing six YouTube-related tools (search, analysis, generation, upload)
- `frontend/` – React + Vite UI with streaming SSE output & reasoning display

## Table of Contents
1. Requirements
2. Environment & Dynamic Auth Headers
3. MCP Tools Catalog
4. Local Development Workflow
5. Dynamic FrontMCP Authentication (Detailed)
6. Troubleshooting
7. Contributing
8. Hackathon Team
9. License

## 1. Requirements
- Python 3.10+
- Node.js 16+ (npm / pnpm / yarn)
- ADK CLI installed (`pip install agent-adk` or per ADK docs)
- Freepik API key (for image generation tools) if using thumbnail/cover features
- Google / Gemini API key (if using Gemini models)

## 2. Environment & Dynamic Auth Headers
Create a top-level `.env` (never commit secrets). Minimal example:
```bash
GOOGLE_API_KEY=your-google-key
GENERATOR_MODEL=gemini-2.5-flash
SERVE_WEB_INTERFACE=true
RELOAD_AGENTS=true
# Dynamic FrontMCP auth headers captured from MCP Inspector (example only)
MCP_EXTRA_HEADERS={"authorization":"Bearer <ephemeral-token>","x-mcp-proxy-auth":"Bearer <ephemeral-token>","mcp-protocol-version":"2025-06-18"}
```
`MCP_EXTRA_HEADERS` is REQUIRED when the MCP server (FrontMCP by Frontegg) mandates auth. Tokens are ephemeral; you must refresh them (see section 5).

Each subproject may also have its own `.env.example` (e.g. `frontend/.env.example`). Copy these to `.env` and fill in required keys before running.

## 3. MCP Tools Catalog
The `agent-tools` server exposes six tools used by the agent:
- search youtube channels – query channels by topic, min subscribers, language
- analyze youtube channels – stats + recent video analysis + recommended actions
- analyze youtube videos – transcript & metadata insights, scene/topic breakdown
- upload youtube videos – upload file + thumbnail + metadata, returns video id
- generate thumbnail – Freepik + base image + modifier to produce variant
- generate cover image – Freepik + description-only hero/cover image generation

## 4. Local Development Workflow
1. Install dependencies:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  # or: uv sync
cd agent-tools && npm install && cd ..
cd frontend && npm install && cd ..
```
2. Start MCP tools server:
```bash
cd agent-tools
npm run dev
```
3. Start ADK API server:
```bash
cd adk_agents
adk api_server
```
4. Start frontend:
```bash
cd frontend
npm run dev
```
5. Open the UI (`http://localhost:5173`) and interact with the agent (it streams SSE responses and shows reasoning, tool usage, and formatted markdown).

Notes:
- Ensure ADK CORS allows `http://localhost:5173`.
- If using `adk_runner.py` (port 8082) update frontend base URL accordingly; recommended is the official `adk api_server`.
- For faster Python dependency installs use `uv` (`pip install uv` then `uv sync`).

## 5. Dynamic FrontMCP Authentication (Detailed)
FrontMCP (Frontegg) issues short-lived tokens. The agent needs those tokens in outbound requests to the MCP server. Workflow:
1. Open the MCP Inspector UI or developer console where FrontMCP runs.
2. Capture the latest auth token(s) from network requests or application storage (e.g. `authorization` or `x-mcp-proxy-auth` headers).
3. Construct `MCP_EXTRA_HEADERS` as a JSON string containing all required headers.
4. Export in your shell before starting ADK or place in `.env`:
```bash
export MCP_EXTRA_HEADERS='{"authorization":"Bearer <copied-token>","x-mcp-proxy-auth":"Bearer <copied-token>","mcp-protocol-version":"2025-06-18"}'
```
5. Restart the ADK API server so the agent picks up the new headers.

Because tokens rotate, repeat this whenever the MCP Inspector shows 401 errors or tool calls fail. Do NOT commit real tokens.

## 6. Troubleshooting
- Empty tool results: Verify fresh `MCP_EXTRA_HEADERS` and that the MCP server is running on the expected port.
- CORS errors: Confirm ADK server started with permissive origins (`localhost:5173`).
- Stale streaming output: Frontend selects the last non-meta SSE event; ensure ADK emits proper event types.
- Auth 401/403: Refresh tokens from Inspector and update `MCP_EXTRA_HEADERS`.

## 7. Contributing
1. Fork & branch.
2. Implement feature or fix (focused commits).
3. Add concise reproduction or validation notes in PR description.
4. Keep changes minimal; avoid unrelated refactors.

## 8. Hackathon Team
- Peixi Xie
- Yuvraj Gupta
- Kyuto Kawabata
- Pramod Thebe

## 9. License
MIT – see `LICENSE`.
