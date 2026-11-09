"""Trek Party Ephemeral Lifecycle State Machine.

Manages transitions: planning -> active -> sync_window -> archived.
Automatically enforces read-only freeze 14 days post-trek.
"""

from datetime import datetime, timezone, timedelta
from typing import Tuple


class PartyLifecycleManager:
    """Finite State Machine controlling party synchronization rules and expiration."""

    VALID_TRANSITIONS = {
        "planning": ["active", "archived"],
        "active": ["sync_window", "archived"],
        "sync_window": ["archived"],
        "archived": [],  # Terminal state
    }

    ARCHIVE_CUTOFF_DAYS = 14

    @classmethod
    def can_transition(cls, current_state: str, next_state: str) -> bool:
        return next_state in cls.VALID_TRANSITIONS.get(current_state, [])

    @classmethod
    def evaluate_state(
        cls,
        current_status: str,
        starts_at: datetime,
        ends_at: datetime,
        now: datetime = None,
    ) -> Tuple[str, bool]:
        """Calculates current dynamic state based on wall-clock time and 14-day archival rule.

        Returns (new_status, has_changed).
        """
        now = now or datetime.now(timezone.utc)
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)

        # Check 14 days post-trek expiration rule
        archive_deadline = ends_at + timedelta(days=cls.ARCHIVE_CUTOFF_DAYS)
        if now >= archive_deadline:
            return "archived", (current_status != "archived")

        if now < starts_at:
            calculated = "planning"
        elif starts_at <= now <= ends_at:
            calculated = "active"
        elif ends_at < now < archive_deadline:
            calculated = "sync_window"
        else:
            calculated = "archived"

        return calculated, (current_status != calculated)

    @classmethod
    def allows_media_upload(cls, status: str) -> bool:
        """Archived parties are frozen read-only."""
        return status in ["active", "sync_window"]

    @classmethod
    def allows_new_members(cls, status: str) -> bool:
        return status in ["planning", "active"]
