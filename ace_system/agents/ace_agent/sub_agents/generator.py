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

# MCP toolset imports for optional tool calling
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
class GeneratorOutput(BaseModel):
    reasoning: list[str] = Field(
        description="Provide step-by-step reasoning process in the format of [step-by-step thought process / reasoning process / detailed analysis and calculation]"
    )
    bullet_ids: list[str] = Field(
        default_factory=list, description="List of playbook bullet IDs referenced"
    )
    final_answer: str = Field(description="Concise final answer")

    # Optional: record which tools (if any) were used to produce the answer
    tools_used: list[str] = Field(
        default_factory=list, description="Optional list of tool names used"
    )


# ============================================
# Generator: Generate answers and traces using playbook
# ============================================
# Create an MCPToolset connected to the provided MCP server. Tool calls are optional.
# Create the MCPToolset for anonymous (no-auth) access to the MCP server.
mcp_tools = MCPToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="https://losing-suggest-federal-assumptions.trycloudflare.com",
    ),
    require_confirmation=False,  # allow agent to call tools automatically when helpful
)

generator = Agent(
    name="Generator",
    model=config.generator_model,
    description="Solve problems by referencing the playbook and return structured final answers.",
    instruction="""
Your task is to answer user queries while providing structured step-by-step reasoning and the bullet IDs you used.

Input:
- User Query: {user_query}
- Current Playbook: {app:playbook}

Tool usage (optional):
- Tools are available to help (search, video analysis, etc.). You may call tools when they help you answer the query.
- If you use a tool, add its name to `tools_used` and summarize the tool output in your reasoning and final_answer.

【Required Guidelines】

1. Carefully read the playbook and apply relevant strategies, formulas, and insights
   - Check all bullet points in the playbook
   - Understand the context and application conditions of each strategy

2. Carefully examine common failures (anti-patterns) listed in the playbook and avoid them
   - Present specific alternatives or best practices

3. Show the reasoning process step by step
   - Clearly indicate which bullets you referenced at each stage
   - Structure so that the logic flow is clear

4. Create thorough but concise analysis
   - Include only essential information, but include all central evidence
   - Avoid unnecessary repetition

5. Review calculations and logic before providing the final answer
   - Confirm that all referenced bullet_ids were actually used
   - Check for logical contradictions
   - Double-check that you haven't missed any relevant playbook bullets

【Output Rules】
- reasoning: Step-by-step thought process (step-by-step chain of thought), detailed analysis and calculations
- bullet_ids: List of referenced playbook bullet IDs
- final_answer: Clear and verified final answer
""",
    tools=[mcp_tools],
    include_contents="none",  # Focus on state value injection
    output_schema=GeneratorOutput,  # Structure output
    output_key="generator_output",  # Save to session.state['generator_output']
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)