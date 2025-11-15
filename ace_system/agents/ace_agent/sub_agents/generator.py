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
You are an expert YouTube video analyst. Your goal is to analyze the provided video details and generate a title, description, and tags for the video.

Use the provided context, transcript, and metadata to inform your analysis. You have access to tools to help you research, upload and generate thumbnails for your video.

Analysis criteria:
- The title should be catchy and relevant to the video content.
- The description should be detailed and include relevant keywords.
- The tags should be a mix of broad and specific keywords.

Input:
- Transcript: {transcript}
- Context: {context}
- Description: {description}
- Views: {views}
- Subscribers: {subscribers}

Respond with a compact JSON object:
{{
  "reasoning": "<step-by-step chain of thought>",
  "title": "<generated title>",
  "description": "<generated description>",
  "tags": ["<tag1>", "<tag2>", "..."]
}}
"""


# -------------------------
# 1) Generator output schema
# -------------------------
class GeneratorOutput(BaseModel):
    reasoning: list[str] = Field(
        description="Provide step-by-step reasoning process in the format of [step-by-step thought process / reasoning process / detailed analysis and calculation]"
    )
    title: str = Field(description="Generated title for the YouTube video")
    description: str = Field(description="Generated description for the YouTube video")
    tags: list[str] = Field(description="Generated tags for the YouTube video")


# ============================================
# Generator: Generate answers and traces using playbook
# ============================================
youtube_tools = MCPToolset(
    # Replace with the actual address of your MCP server.
    # Newer ADK versions expect a `connection_params` object instead of
    # `mcp_server_address`. Use StreamableHTTPConnectionParams for an
    # HTTP(S) MCP server endpoint.
    connection_params=StreamableHTTPConnectionParams(
        url="https://dat-certification-costs-keyword.trycloudflare.com",
    ),
)


generator = Agent(
    name="Generator",
    model=config.generator_model,
    description="Analyzes YouTube video data and generates a title, description, and tags.",
    instruction="""
Your task is to analyze the provided YouTube video data and generate a title, description, and tags.

Input:
- Transcript: {transcript}
- Context: {context}
- Description: {description}
- Views: {views}
- Subscribers: {subscribers}

【Required Guidelines】

1.  Analyze the transcript and context to understand the video's content and message.
2.  Use the available tools to research similar videos and identify effective titles, descriptions, and tags.
3.  Generate a compelling title that is likely to attract viewers.
4.  Write a detailed description that includes important keywords and a summary of the video.
5.  Create a list of relevant tags that will help the video get discovered.

【Output Rules】
- reasoning: Step-by-step thought process for how you arrived at the title, description, and tags.
- title: The generated title.
- description: The generated description.
- tags: A list of generated tags.
""",
    tools=[youtube_tools],
    include_contents="none",  # Focus on state value injection
    output_schema=GeneratorOutput,  # Structure output
    output_key="generator_output",  # Save to session.state['generator_output']
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)
