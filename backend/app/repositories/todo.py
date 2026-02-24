from datetime import date, timedelta
from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session
from app.models.todo import Todo
from app.schemas.todo import TodoProgressStatus


class TodoRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_owner(
        self,
        owner_id: int,
        keyword: str | None = None,
        progress_status: TodoProgressStatus | None = None,
        due_date: str | None = None,
    ) -> List[Todo]:
        db_query = self.db.query(Todo).filter(Todo.owner_id == owner_id)

        if keyword:
            db_query = db_query.filter(
                or_(
                    Todo.name.contains(keyword, autoescape=True),
                    Todo.detail.contains(keyword, autoescape=True),
                )
            )

        if progress_status:
            db_query = db_query.filter(Todo.progress_status == progress_status)

        if due_date and due_date != "all":
            today = date.today()
            if due_date == "today":
                db_query = db_query.filter(Todo.due_date == today)
            elif due_date == "this_week":
                end_date = today + timedelta(days=6)
                db_query = db_query.filter(
                    Todo.due_date >= today,
                    Todo.due_date <= end_date,
                )
            elif due_date == "overdue":
                db_query = db_query.filter(Todo.due_date < today)
            elif due_date == "none":
                db_query = db_query.filter(Todo.due_date.is_(None))

        return db_query.order_by(Todo.created_at.desc()).all()

    def get(self, todo_id: int, owner_id: int) -> Optional[Todo]:
        return (
            self.db.query(Todo)
            .filter(Todo.id == todo_id, Todo.owner_id == owner_id)
            .first()
        )

    def create(self, todo: Todo) -> Todo:
        self.db.add(todo)
        return todo

    def create_recurrence_successor(
        self, source_todo: Todo, next_due_date: date
    ) -> None:
        stmt = (
            insert(Todo)
            .values(
                name=source_todo.name,
                detail=source_todo.detail,
                owner_id=source_todo.owner_id,
                due_date=next_due_date,
                progress_status="not_started",
                recurrence_type=source_todo.recurrence_type,
                previous_todo_id=source_todo.id,
            )
            .on_conflict_do_nothing(index_elements=["previous_todo_id"])
        )
        self.db.execute(stmt)

    def count_subtasks(self, parent_id: int, owner_id: int) -> int:
        return (
            self.db.query(Todo)
            .filter(Todo.parent_id == parent_id, Todo.owner_id == owner_id)
            .count()
        )

    def count_completed_subtasks(self, parent_id: int, owner_id: int) -> int:
        return (
            self.db.query(Todo)
            .filter(
                Todo.parent_id == parent_id,
                Todo.owner_id == owner_id,
                Todo.progress_status == "completed",
            )
            .count()
        )

    def has_incomplete_subtasks(self, parent_id: int, owner_id: int) -> bool:
        return (
            self.db.query(Todo.id)
            .filter(
                Todo.parent_id == parent_id,
                Todo.owner_id == owner_id,
                Todo.progress_status != "completed",
            )
            .first()
            is not None
        )

    def delete(self, todo: Todo) -> None:
        self.db.delete(todo)

    def check_name_exists(
        self, owner_id: int, name: str, exclude_id: Optional[int] = None
    ) -> bool:
        """指定されたユーザーIDと名前の組み合わせでタスクが存在するかをチェック

        Args:
            owner_id: タスクの所有者ID
            name: チェックするタスク名
            exclude_id: チェックから除外するタスクID（更新時に自分自身を除外する等）

        Returns:
            bool: タスクが存在する場合True、存在しない場合False
        """
        query = self.db.query(Todo).filter(
            Todo.owner_id == owner_id,
            Todo.name == name,
            Todo.progress_status != "completed",
        )
        if exclude_id is not None:
            query = query.filter(Todo.id != exclude_id)
        return query.first() is not None
