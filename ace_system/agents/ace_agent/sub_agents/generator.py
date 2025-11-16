"""Prompt templates for ACE roles - fully customizable for your use case.

These default prompts are adapted from the ACE paper. You can customize them
to better suit your specific task by providing your own templates when
initializing the Generator, Reflector, and Curator.

Customization Example:
>>> from ace import Generator
>>> from ace.llm_providers import LiteLLMClient
>>>
>>> # Custom generator prompt for code tasks
>>> code_generator_prompt = '''
... You are a senior developer. Use the playbook to write clean code...
...
... Playbook: {playbook}
... Reflection: {reflection}
... Task: {question}
... Requirements: {context}
...
... Return JSON with:
... - reasoning: Your approach
... - bullet_ids: Applied strategies
... - final_answer: The code solution
... '''
>>>
>>> client = LiteLLMClient(model="gpt-4")
>>> generator = Generator(client, prompt_template=code_generator_prompt)

Prompt Variables:

Generator:
- {playbook}: Current playbook strategies
- {reflection}: Recent reflection context
- {question}: The question/task to solve
- {context}: Additional requirements or context

Reflector:
- {question}: Original question
- {reasoning}: Generator's reasoning
- {prediction}: Generator's answer
- {ground_truth}: Correct answer if available
- {feedback}: Environment feedback
- {playbook_excerpt}: Relevant playbook bullets used

Curator:
- {progress}: Training progress summary
- {stats}: Playbook statistics
- {reflection}: Latest reflection analysis
- {playbook}: Current full playbook
- {question_context}: Question and feedback context

Tips for Custom Prompts:
1. Keep JSON output format consistent
2. Be specific about your domain (math, code, writing, etc.)
3. Add task-specific instructions and constraints
4. Test with your actual use cases
5. Iterate based on the quality of generated strategies
"""

from google.adk.agents import Agent
from pydantic import BaseModel, Field
from google.adk.tools import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams

from config import Config

config = Config()


# Default Generator prompt - produces answers using playbook strategies
GENERATOR_PROMPT = """
You are an expert assistant that must solve the task using the provided playbook of strategies.

Apply relevant bullets, avoid known mistakes, and show step-by-step reasoning.

Playbook:
{playbook}

Recent reflection:
{reflection}

Question:
{question}

Additional context:
{context}

Respond with a compact JSON object:
{{
  "reasoning": "<step-by-step chain of thought>",
  "bullet_ids": ["<id1>", "<id2>", "..."],
  "final_answer": "<concise final answer>"
}}
"""


# -------------------------
# 1) Generator output schema
# -------------------------
class ChannelInfo(BaseModel):
    name: str = Field(description="Channel name")
    subscribers: str = Field(description="Number of subscribers")
    totalViews: str = Field(description="Total views")
    videoCount: int = Field(description="Number of videos")
    channelId: str = Field(description="YouTube channel ID")

class GeneratorOutput(BaseModel):
    reasoning: list[str] = Field(
        description="Provide step-by-step reasoning process for the YouTube search and analysis"
    )
    content: str = Field(description="Response content explaining the results")
    channels: list[ChannelInfo] = Field(description="List of found YouTube channels")


# ============================================
# Generator: Generate answers and traces using playbook
# ============================================
youtube_tools = MCPToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="http://localhost:3001"
    ),
    tool_name_prefix="youtube_"
)


generator = Agent(
    name="Generator",
    model=config.generator_model,
    description="Searches and analyzes YouTube channels based on user queries.",
    instruction="""
Your task is to search for and analyze YouTube channels based on the user's query.

User Query: {user_query}

【Required Guidelines】

1. Analyze the user's query to understand what type of YouTube channels they're looking for.
2. Use the available YouTube tools to search for channels that match the criteria.
3. Use channel analysis tools to get detailed statistics for the found channels.
4. Format the results with channel names, subscriber counts, total views, video counts, and channel IDs.
5. Provide a helpful summary of the search results.

【Available Tools】
You have access to YouTube search and analysis tools that can help you:
- Search for channels by keywords
- Get channel statistics and analytics
- Analyze video content and performance

【Output Rules】
- reasoning: Step-by-step thought process for how you searched and analyzed the channels.
- content: A summary message explaining what you found and how many channels match the criteria.
- channels: A list of channel objects with name, subscribers, totalViews, videoCount, and channelId.
""",
    include_contents="none",  # Focus on state value injection
    output_schema=GeneratorOutput,  # Structure output
    output_key="generator_output",  # Save to session.state['generator_output']
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)