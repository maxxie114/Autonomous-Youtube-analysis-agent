from __future__ import annotations

import logging
from typing import AsyncGenerator

from google.adk.agents import BaseAgent, SequentialAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions

from .schemas.playbook import Playbook
from .sub_agents import curator, generator, reflector

logger = logging.getLogger(__name__)


class StateInitializer(BaseAgent):
    """Initialize session state with user query and playbook."""

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        state = ctx.session.state
        state_changes = {}
        
        # Set user query
        state_changes["user_query"] = ctx.user_content
        logger.info(f"User query: {ctx.user_content}")

        # Initialize playbook if not exists
        if "app:playbook" not in state:
            pb = Playbook()
            state_changes["app:playbook"] = pb.to_dict()
            logger.info("Initialized new playbook")

        # Initialize ground_truth if not exists
        if "ground_truth" not in state:
            state_changes["ground_truth"] = None

        yield Event(
            author=self.name,
            invocation_id=ctx.invocation_id,
            actions=EventActions(state_delta=state_changes),
        )


state_initializer = StateInitializer(name="StateInitializer")

ace_iteration = SequentialAgent(
    name="ACE_Iteration",
    sub_agents=[
        state_initializer,
        generator,
        reflector,
        curator,
    ],
    description="Execute one ACE cycle: Generate → Reflect → Curate",
)

root_agent = ace_iteration
