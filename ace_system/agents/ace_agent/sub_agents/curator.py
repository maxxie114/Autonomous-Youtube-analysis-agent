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

import logging
from typing import AsyncGenerator

from google.adk.agents import Agent, BaseAgent, SequentialAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai.types import Part, UserContent

from agents.ace_agent.schemas import DeltaBatch, Playbook
from config import Config

logger = logging.getLogger(__name__)
config = Config()


# Default Curator prompt - updates playbook based on reflections
CURATOR_PROMPT = """
You are the curator of the ACE playbook. Merge the latest reflection into structured updates.

Only add genuinely new material. Do not regenerate the entire playbook.

Respond with a single valid JSON object only—no analysis or extra narration.

Training progress: {progress}

Playbook stats: {stats}

Recent reflection:
{reflection}

Current playbook:
{playbook}

Question context:
{question_context}

Respond with JSON:
{{
  "reasoning": "<how you decided on the updates>",
  "operations": [
    {{
      "type": "ADD|UPDATE|TAG|REMOVE",
      "section": "<section name>",
      "content": "<bullet text>",
      "bullet_id": "<optional existing id>",
      "metadata": {{"helpful": 1, "harmful": 0}}
    }}
  ]
}}

If no updates are required, return an empty list for "operations".
"""

# ============================================
# Curator: Expert in curating playbooks
# ============================================
curator_ = Agent(
    name="Curator",
    model=config.curator_model,
    description="Expert in curating playbooks.",
    instruction="""You are an expert in curating playbooks.

Considering the existing playbook and reflections from previous attempts:
- Identify only new insights, strategies, and failures that are **missing** from the current playbook
- You can **improve existing bullets with better content** or **remove erroneous/duplicate items**
- Avoid duplication - if similar advice already exists, add only new content that perfectly complements the existing playbook
- Do not regenerate the entire playbook - provide only necessary additions/modifications/deletions
- Focus on quality over quantity - a focused and organized playbook is better than a comprehensive one
- Each change must be specific and justified

Input:
- User Query: {user_query}
- Reflector Results: {reflector_output}
- Current Playbook: {app:playbook}

CRITICAL: You must respond with ONLY valid JSON. No markdown, no explanations, no code blocks.

Response format (maximum 3 operations per response):
{
  "reasoning": "Brief explanation (max 200 characters)",
  "operations": [
    {
      "type": "ADD",
      "section": "general",
      "content": "Specific actionable advice (max 150 characters)"
    },
    {
      "type": "UPDATE", 
      "bullet_id": "existing-id",
      "content": "Improved content (max 150 characters)"
    },
    {
      "type": "REMOVE",
      "bullet_id": "id-to-remove"
    }
  ]
}

Rules:
- Maximum 3 operations per response
- Keep content concise and actionable
- Ensure all JSON strings are properly escaped
- If no changes needed, return: {"reasoning": "No changes needed", "operations": []}""",
    include_contents="none",
    output_schema=DeltaBatch,
    output_key="curator_output",
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)


class PlaybookUpdater(BaseAgent):
    """Apply curator delta operations to the playbook."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        state = ctx.session.state
        curator_output: dict | None = state.get("curator_output")
        
        if not curator_output:
            logger.warning("No curator output found in state")
            return
            
        delta_batch = DeltaBatch.from_dict(curator_output)
        logger.info(f"Applying {len(delta_batch.operations)} operations to playbook")

        playbook_dict: dict | None = state.get("app:playbook")
        if not playbook_dict:
            logger.error("No playbook found in state")
            return
            
        playbook = Playbook.from_dict(playbook_dict)
        playbook.apply_delta(delta_batch)

        state_changes = {"app:playbook": playbook.to_dict()}

        # Format operations for display
        op_lines = []
        for op in delta_batch.operations:
            bullet_ref = f"[{op.bullet_id}]" if op.bullet_id else ""
            content_text = op.content or "(no content)"
            op_lines.append(
                f"- {op.type:6} {op.section:12} {bullet_ref:15} {content_text}"
            )
        
        pretty = "\n".join(op_lines) or "(no changes)"
        logger.info(f"Playbook updated: {len(delta_batch.operations)} operations applied")
        
        content = UserContent(
            parts=[Part(text=f"[Curator] Playbook Changes:\n{pretty}")]
        )
        yield Event(
            author=self.name,
            invocation_id=ctx.invocation_id,
            content=content,
            actions=EventActions(state_delta=state_changes),
        )


playbook_updater = PlaybookUpdater(
    name="playbook_updater", description="Updates the playbook."
)


curator = SequentialAgent(
    name="Curator",
    description="Execute Curator and PlaybookUpdater sequentially.",
    sub_agents=[curator_, playbook_updater],
)
