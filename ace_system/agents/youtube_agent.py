
#!/usr/bin/env python3
"""YouTube ADK Agent

This module defines a simple ADK `Agent` that answers user questions about
YouTube videos. It is configured to use a Gemini model (from `ace_system/config.py`)
and can optionally call tools exposed by a local MCP server running at
`http://localhost:3001` (anonymous access).

Usage:
- Run this with the ADK runtime (the ADK web server will discover agents in
  the `ace_system/agents` package) or run locally in test mode.

The agent accepts a `question` input and will call MCP tools when helpful.
Tool calls are optional and performed anonymously against the local MCP server.
"""
from __future__ import annotations

import os
from typing import Optional

from google.adk.agents import Agent
from google.adk.tools import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from pydantic import BaseModel, Field

# Read model selection and API config from the project's Config
from ace_system.config import Config

config = Config()


class YouTubeOutput(BaseModel):
    reasoning: list[str] = Field(default_factory=list)
    answer: str = Field(default="")
    tools_used: list[str] = Field(default_factory=list)


# Create an MCPToolset pointing at your local tools server (anonymous)
mcp_tools = MCPToolset(
    connection_params=StreamableHTTPConnectionParams(url="http://localhost:3001"),
    require_confirmation=False,
)


# Build the Agent. The instruction template uses `{question}` as input.
youtube_agent = Agent(
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


def run_test(question: Optional[str] = None) -> None:
    """Simple interactive test harness.

    This will not start the ADK webserver; it's a convenience for local
    experimentation. It prints the agent object and instructions. To run the
    agent inside ADK HTTP runtime, start the ADK web server instead.
    """
    print("YouTubeAssistant configured with model:", youtube_agent.model)
    print("MCP tools URL: http://localhost:3001 (anonymous)")
    if question is None:
        question = input("Enter a question for the agent (or 'exit'): ").strip()
    if not question or question.lower() == "exit":
        print("Exiting test harness")
        return
    # The ADK runtime orchestrates agent execution; here we only show the
    # instruction template and how to pass a question when using the ADK CLI.
    print("To invoke this agent via ADK runtime, send the question as the user input")
    print("Example: use the web UI or ADK client to run with `question` payload")
    print("Configured instruction:\n")
    print(youtube_agent.instruction)
    print("\n(For full execution and tool calls, run the ADK web server which will invoke this agent within the ADK framework.)")


if __name__ == "__main__":
    run_test()
