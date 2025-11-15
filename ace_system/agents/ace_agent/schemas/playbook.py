from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from .delta import DeltaBatch, DeltaOperation


class Bullet(BaseModel):
    """Single playbook entry."""

    id: str
    section: str
    content: str
    helpful: int = 0
    harmful: int = 0
    neutral: int = 0
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def tag(
        self, tag: Literal["helpful", "harmful", "neutral"], increment: int = 1
    ) -> None:
        """Update tag count and timestamp."""
        current = getattr(self, tag)
        setattr(self, tag, current + int(increment))
        self.updated_at = datetime.now(timezone.utc).isoformat()


class Playbook(BaseModel):
    """Structured context store as defined by ACE."""

    bullets: dict[str, Bullet] = Field(default_factory=dict)
    sections: dict[str, list[str]] = Field(default_factory=dict)
    next_id: int = 0

    def add_bullet(
        self,
        section: str,
        content: str,
        bullet_id: str | None = None,
    ) -> Bullet:
        """Add a new bullet to the playbook."""
        bullet_id = bullet_id or self._generate_id(section)
        bullet = Bullet(id=bullet_id, section=section, content=content)
        self.bullets[bullet_id] = bullet
        self.sections.setdefault(section, []).append(bullet_id)
        return bullet

    def update_bullet(
        self,
        bullet_id: str,
        content: str,
    ) -> Bullet | None:
        """Update an existing bullet's content."""
        bullet = self.bullets.get(bullet_id)
        if bullet is None:
            return None
        bullet.content = content
        bullet.updated_at = datetime.now(timezone.utc).isoformat()
        return bullet

    def remove_bullet(self, bullet_id: str) -> None:
        """Remove a bullet from the playbook."""
        bullet = self.bullets.pop(bullet_id, None)
        if bullet is None:
            return
        section_list = self.sections.get(bullet.section)
        if section_list:
            self.sections[bullet.section] = [
                bid for bid in section_list if bid != bullet_id
            ]
            if not self.sections[bullet.section]:
                del self.sections[bullet.section]

    def update_bullet_tag(
        self,
        bullet_id: str,
        tag: Literal["helpful", "harmful", "neutral"],
        increment: int = 1,
    ) -> Bullet | None:
        """Update a bullet's tag count."""
        bullet = self.bullets.get(bullet_id)
        if bullet is None:
            return None
        bullet.tag(tag, increment=increment)
        return bullet

    def get_bullet(self, bullet_id: str) -> Bullet | None:
        """Get a bullet by ID."""
        return self.bullets.get(bullet_id)

    def bullets_list(self) -> list[Bullet]:
        """Get all bullets as a list."""
        return list(self.bullets.values())

    def to_dict(self) -> dict[str, object]:
        """Convert playbook to dictionary."""
        return self.model_dump()

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "Playbook":
        """Create playbook from dictionary."""
        return cls.model_validate(payload)

    def dumps(self) -> str:
        """Serialize playbook to JSON string."""
        return self.model_dump_json(indent=2)

    @classmethod
    def loads(cls, data: str) -> "Playbook":
        """Deserialize playbook from JSON string."""
        return cls.model_validate_json(data)

    def apply_delta(self, delta: DeltaBatch) -> None:
        """Apply a batch of delta operations to the playbook."""
        for operation in delta.operations:
            self._apply_operation(operation)

    def _apply_operation(self, operation: DeltaOperation) -> None:
        """Apply a single delta operation."""
        op_type = operation.type.upper()
        if op_type == "ADD":
            self.add_bullet(
                section=operation.section,
                content=operation.content or "",
                bullet_id=operation.bullet_id,
            )
        elif op_type == "UPDATE":
            if operation.bullet_id and operation.content:
                self.update_bullet(
                    bullet_id=operation.bullet_id,
                    content=operation.content,
                )
        elif op_type == "REMOVE":
            if operation.bullet_id:
                self.remove_bullet(operation.bullet_id)

    def as_prompt(self) -> str:
        """Return a human-readable playbook string for prompting LLMs."""
        if not self.sections:
            return "No playbook entries yet."
        
        parts: list[str] = []
        for section, bullet_ids in sorted(self.sections.items()):
            parts.append(f"## {section}")
            for bullet_id in bullet_ids:
                bullet = self.bullets[bullet_id]
                counters = f"(helpful={bullet.helpful}, harmful={bullet.harmful}, neutral={bullet.neutral})"
                parts.append(f"- [{bullet.id}] {bullet.content} {counters}")
        return "\n".join(parts)

    def stats(self) -> dict[str, object]:
        """Get playbook statistics."""
        return {
            "sections": len(self.sections),
            "bullets": len(self.bullets),
            "tags": {
                "helpful": sum(b.helpful for b in self.bullets.values()),
                "harmful": sum(b.harmful for b in self.bullets.values()),
                "neutral": sum(b.neutral for b in self.bullets.values()),
            },
        }

    def _generate_id(self, section: str) -> str:
        """Generate a unique bullet ID."""
        self.next_id += 1
        section_prefix = (section or "general").split()[0].lower()
        return f"{section_prefix}-{self.next_id:05d}"
