from datetime import date, datetime
from typing import TYPE_CHECKING, Literal, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

if TYPE_CHECKING:
    from app.models.user import User

from app.database import Base


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint(
            "progress_status IN ('not_started', 'in_progress', 'completed')",
            name="ck_todos_progress_status",
        ),
        Index(
            "ix_todo_owner_name_incomplete_unique",
            "owner_id",
            "name",
            unique=True,
            sqlite_where=text("progress_status != 'completed'"),
        ),
        Index(
            "ix_todo_owner_progress_status_created_at",
            "owner_id",
            "progress_status",
            "created_at",
        ),
        Index("idx_todos_parent_id", "parent_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    progress_status: Mapped[Literal["not_started", "in_progress", "completed"]] = (
        mapped_column(
            String(20),
            default="not_started",
            server_default="not_started",
            nullable=False,
        )
    )
    recurrence_type: Mapped[Literal["none", "daily", "weekly", "monthly"]] = (
        mapped_column(
            String(20),
            default="none",
            server_default="none",
            nullable=False,
        )
    )
    previous_todo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("todos.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("todos.id", ondelete="CASCADE"),
        nullable=True,
    )

    owner: Mapped["User"] = relationship("User", backref="todos")
    previous_todo: Mapped[Optional["Todo"]] = relationship(
        "Todo",
        remote_side=[id],
        foreign_keys=[previous_todo_id],
        uselist=False,
    )
    parent: Mapped[Optional["Todo"]] = relationship(
        "Todo",
        remote_side=[id],
        foreign_keys=[parent_id],
        back_populates="subtasks",
    )
    subtasks: Mapped[list["Todo"]] = relationship(
        "Todo",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )
