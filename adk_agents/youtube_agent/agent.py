#!/usr/bin/env python3
"""ADK agent package (standalone) for YouTubeAssistant.

This copy is independent of `ace_system` and reads model config from env
variable `GENERATOR_MODEL` (falls back to `gemini-2.5-flash`). It attaches an
anonymous MCP toolset at http://localhost:3001.

Expose `root_agent` so ADK loader can find it under the agents directory.
"""
from __future__ import annotations

import os
import json
from pydantic import BaseModel, Field
from google.adk.agents import Agent
from google.adk.tools import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.agents.readonly_context import ReadonlyContext


class YouTubeOutput(BaseModel):
    reasoning: list[str] = Field(default_factory=list)
    answer: str = Field(default="")
    tools_used: list[str] = Field(default_factory=list)


# Anonymous MCP toolset (local developer tools at localhost:3001)
_mcp_headers = None
if os.getenv("MCP_EXTRA_HEADERS"):
    try:
        _mcp_headers = json.loads(os.getenv("MCP_EXTRA_HEADERS"))
    except Exception:
        _mcp_headers = None

if _mcp_headers:
    def _header_provider(_: ReadonlyContext):
        # Return a shallow copy to be safe
        return dict(_mcp_headers)

    mcp_tools = MCPToolset(
        connection_params=StreamableHTTPConnectionParams(url="http://localhost:3001", headers=None),
        header_provider=_header_provider,
        require_confirmation=False,
    )
else:
    mcp_tools = MCPToolset(
        connection_params=StreamableHTTPConnectionParams(url="http://localhost:3001"),
        require_confirmation=False,
    )

MODEL = os.getenv("GENERATOR_MODEL", "gemini-2.5-flash")


root_agent = Agent(
        name="YouTubeAssistant",
        model=MODEL,
        description="Answer YouTube-related questions; optionally call local MCP tools.",
        instruction="""
You are a YouTube assistant. Answer the user's latest message using the chat
conversation as context. If a session state variable `question` is present it
may also be used, but it is optional.

Tool behavior (optional):
- You may call tools available in the toolset to fetch transcripts or video
    analytics when it helps answer the user's message. If you call tools, list
    their names in `tools_used` and summarize results in the `answer`.

Return a JSON object with fields: reasoning (list of short steps), answer, tools_used.
""",
        tools=[mcp_tools],
        include_contents="none",
        output_schema=YouTubeOutput,
        output_key="youtube_output",
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
)
