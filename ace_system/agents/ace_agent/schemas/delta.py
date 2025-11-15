from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

OperationType = Literal["ADD", "UPDATE", "REMOVE"]


class DeltaOperation(BaseModel):
    """Single mutation to apply to the playbook."""

    model_config = ConfigDict(extra="ignore")

    type: OperationType
    section: str
    content: str | None = None
    bullet_id: str | None = None

    def to_dict(self) -> dict:
        """Keep payload lean by dropping None fields."""
        return self.model_dump(exclude_none=True)


class DeltaBatch(BaseModel):
    """Bundle of curator reasoning and delta operations."""

    model_config = ConfigDict(extra="ignore")

    reasoning: str
    operations: list[DeltaOperation] = Field(default_factory=list)

    @classmethod
    def from_dict(cls, payload: dict) -> "DeltaBatch":
        """Create DeltaBatch from dictionary."""
        return cls.model_validate(payload)

    def to_dict(self) -> dict:
        """Convert to dictionary, excluding None values."""
        return self.model_dump(exclude_none=True)
