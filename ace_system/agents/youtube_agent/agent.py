#!/usr/bin/env python3
"""YouTube ADK Agent package entrypoint.

This module exposes `root_agent` which the ADK loader expects.
It attaches an anonymous MCP toolset at http://localhost:3001 and uses the
model configured in `ace_system.config.Config` (defaults to Gemini).
"""
from __future__ import annotations

from typing import Optional

from google.adk.agents import Agent
from google.adk.tools import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from pydantic import BaseModel, Field

from ace_system.config import Config

config = Config()


class YouTubeOutput(BaseModel):
    reasoning: list[str] = Field(default_factory=list)
    answer: str = Field(default="")
    tools_used: list[str] = Field(default_factory=list)


# Anonymous MCP toolset (local developer tools at localhost:3001)
mcp_tools = MCPToolset(
    connection_params=StreamableHTTPConnectionParams(url="http://localhost:3001"),
    require_confirmation=False,
)


# The agent instance ADK expects is exposed as `root_agent`.
root_agent = Agent(
    name="YouTubeAssistant",
    model=getattr(config, "generator_model", "gemini-2.5-flash"),
    description="Answer YouTube-related questions; optionally call local MCP tools.",
    instruction="""
You are a YouTube assistant. Answer the user's `question` using available context.

Input:
- question: {question}

Tool behavior (optional):
- You may call tools available in the toolset to fetch transcripts or video
  analytics when it helps answer the question. If you call tools, list their
  names in `tools_used` and summarize results in the `answer`.

Return a JSON object with fields: reasoning (list of short steps), answer, tools_used.
""",
    tools=[mcp_tools],
    include_contents="none",
    output_schema=YouTubeOutput,
    output_key="youtube_output",
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)
