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
from typing import AsyncGenerator, Literal

from google.adk.agents import Agent, BaseAgent, SequentialAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai.types import Part, UserContent
from pydantic import BaseModel, Field

from agents.ace_agent.schemas.playbook import Playbook
from config import Config

logger = logging.getLogger(__name__)
config = Config()


# Default Reflector prompt - analyzes what went right/wrong
REFLECTOR_PROMPT = """
You are a senior reviewer diagnosing the generator's trajectory.

Use the playbook, model reasoning, and feedback to identify mistakes and actionable insights.

Output must be a single valid JSON object. Do NOT include analysis text or explanations outside the JSON.
Begin the response with `{{` and end with `}}`.

Question:
{question}

Model reasoning:
{reasoning}

Model prediction: {prediction}

Ground truth (if available): {ground_truth}

Feedback: {feedback}

Playbook excerpts consulted:
{playbook_excerpt}

Return JSON:
{{
  "reasoning": "<analysis>",
  "error_identification": "<what went wrong>",
  "root_cause_analysis": "<why it happened>",
  "correct_approach": "<what should be done>",
  "key_insight": "<reusable takeaway>",
  "bullet_tags": [{{"id": "<bullet-id>", "tag": "helpful|harmful|neutral"}}]
}}
"""


# -------------------------
# 2) Reflector output schema
# -------------------------
class BulletTag(BaseModel):
    id: str = Field(description="bullet-id")
    tag: Literal["helpful", "harmful", "neutral"] = Field(
        description="tag classification"
    )


class Reflection(BaseModel):
    reasoning: str = Field(description="Thought process and detailed analysis and calculations")
    error_identification: str = Field(
        description="What exactly was wrong in the reasoning"
    )
    root_cause_analysis: str = Field(
        description="Why did this error occur? Which concepts were misunderstood?"
    )
    correct_approach: str = Field(description="What should the model have done instead?")
    key_insight: str = Field(
        description="What strategy, formula, or principle should be remembered to avoid such errors?"
    )
    bullet_tags: list[BulletTag] = Field(
        default_factory=list,
        description="Bullet re-tagging (id and helpful/harmful/neutral tags)",
    )

    @classmethod
    def from_dict(cls, payload: dict) -> "Reflection":
        return cls.model_validate(payload)


# ============================================
# Reflector: Critically analyze errors/patterns
# ============================================
reflector_ = Agent(
    name="Reflector",
    model=config.reflector_model,
    description="Critically analyze errors and patterns to identify improvement points.",
    instruction="""
Your task is to carefully examine the generator's output, critically analyze it, and create a reflection (JSON).

Input:
- User query: {user_query}
- Generator output: {generator_output}
- Generator-referenced playbook bullet: {app:playbook}

【Required Analysis Steps】

1. Carefully analyze the model's reasoning trace to understand where errors occurred
   - Review the generator's entire reasoning
   - Check for leaps or contradictions in the logic flow

2. Identify specific error types: conceptual errors, calculation mistakes, strategy misuse, etc.
   - Clearly describe the characteristics of each error
   - Find the root causes behind surface-level errors

3. Provide actionable insights so the model doesn't make the same mistakes in the future
   - Present specific procedures or checklists
   - Derive generalizable principles

4. Evaluate each bullet point used by the generator
   - Tag each bullet_id as ['helpful', 'harmful', 'neutral']
   - helpful: bullets that helped with the correct answer
   - harmful: incorrect or misleading bullets that led to wrong answers
   - neutral: bullets that didn't affect the final result

【Output Rules】
- reasoning: Thought process that went through all 4 analysis steps above, detailed analysis and evidence
- error_identification: Specifically describe what exactly was wrong in the reasoning
- root_cause_analysis: What was the root cause of this error? Which concepts were misunderstood? Which strategies were misused?
- correct_approach: What should the generator have done instead? Present accurate steps and logic
- key_insight: Strategy, formula, principle, or checklist that should be remembered to avoid such errors
- bullet_tags: Tagging results for each bullet referenced by the generator (including id and 'helpful'/'harmful'/'neutral')
""",
    include_contents="none",
    output_schema=Reflection,
    output_key="reflector_output",  # session.state['reflector_output']
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)


class TagBullet(BaseAgent):
    """Apply reflection tags to playbook bullets."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        state = ctx.session.state

        reflector_output: dict | None = state.get("reflector_output")
        if not reflector_output:
            logger.warning("No reflector output found in state")
            return
            
        reflector_output: Reflection = Reflection.from_dict(reflector_output)
        bullet_tags = reflector_output.bullet_tags
        logger.info(f"Tagging {len(bullet_tags)} bullets")

        playbook_dict: dict | None = state.get("app:playbook")
        if not playbook_dict:
            logger.error("No playbook found in state")
            return
            
        playbook = Playbook.from_dict(playbook_dict)

        # Apply tags to bullets
        tag_lines: list[str] = []
        for bullet_tag in bullet_tags:
            bullet_id = bullet_tag.id
            tag = bullet_tag.tag
            result = playbook.update_bullet_tag(bullet_id=bullet_id, tag=tag)
            if result:
                tag_lines.append(f"- [{bullet_id}] {tag}")
            else:
                logger.warning(f"Bullet {bullet_id} not found in playbook")

        state_changes = {"app:playbook": playbook.to_dict()}
        pretty = "\n".join(tag_lines) or "(no changes)"
        logger.info(f"Tagged {len(tag_lines)} bullets successfully")
        
        content = UserContent(
            parts=[Part(text=f"[Reflector] Bullet Tagging Results:\n{pretty}")]
        )
        yield Event(
            author=self.name,
            invocation_id=ctx.invocation_id,
            content=content,
            actions=EventActions(state_delta=state_changes),
        )


tag_bullet = TagBullet(name="tag_bullet", description="Tags bullets.")

reflector = SequentialAgent(
    name="Reflector",
    description="Execute Reflector and TagBullet sequentially.",
    sub_agents=[reflector_, tag_bullet],
)
