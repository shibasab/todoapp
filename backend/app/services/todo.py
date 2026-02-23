import calendar
from datetime import date, timedelta
from typing import List, NewType, cast
from sqlalchemy.orm import Session

from app.models.todo import Todo
from app.schemas.todo import (
    TodoCreate,
    TodoUpdate,
    TodoProgressStatus,
    TodoRecurrenceType,
)
from app.repositories.todo import TodoRepository
from app.exceptions import (
    NotFoundError,
    DuplicateError,
    RequiredFieldError,
    InvalidParentTodoError,
    ParentTodoCompletionBlockedError,
    SubtaskRecurrenceNotAllowedError,
)


# ビジネスバリデーション完了済みのTODOデータを表す型
# 静的型チェッカーがバリデーション済みかどうかを区別できる
ValidatedTodoData = NewType("ValidatedTodoData", TodoCreate)
ValidatedTodoUpdate = NewType("ValidatedTodoUpdate", TodoUpdate)


class TodoService:
    def __init__(self, db: Session, repo: TodoRepository):
        self.db = db
        self.repo = repo

    def get_todos(
        self,
        owner_id: int,
        keyword: str | None = None,
        progress_status: TodoProgressStatus | None = None,
        due_date: str | None = None,
    ) -> List[Todo]:
        normalized_keyword = self._normalize_search_term(keyword)
        return self.repo.get_by_owner(
            owner_id,
            keyword=normalized_keyword,
            progress_status=progress_status,
            due_date=due_date,
        )

    def _normalize_search_term(self, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    def _ensure_name_unique(
        self, owner_id: int, name: str, exclude_id: int | None = None
    ) -> None:
        """指定した名前が既存のTodoと重複していないことを保証する"""
        if self.repo.check_name_exists(owner_id, name, exclude_id=exclude_id):
            raise DuplicateError(
                f"Task with name '{name}' already exists", field="name"
            )

    def _validate_todo(
        self, owner_id: int, data: TodoCreate, exclude_id: int | None = None
    ) -> ValidatedTodoData:
        """TODOデータのバリデーションを行い、バリデーション済みデータを返す"""
        self._validate_recurrence_due_date(data.due_date, data.recurrence_type)
        self._validate_parent(owner_id, data.parent_id)
        self._validate_subtask_recurrence(
            is_subtask=data.parent_id is not None,
            recurrence_type=data.recurrence_type,
        )
        self._ensure_name_unique(owner_id, data.name, exclude_id=exclude_id)
        return ValidatedTodoData(data)

    def _validate_parent(self, owner_id: int, parent_id: int | None) -> Todo | None:
        if parent_id is None:
            return None

        parent = self.repo.get(parent_id, owner_id)
        if parent is None:
            raise InvalidParentTodoError("親タスクが存在しません")
        if parent.parent_id is not None:
            raise InvalidParentTodoError("サブタスクを親として指定できません")
        return parent

    def _validate_subtask_recurrence(
        self,
        is_subtask: bool,
        recurrence_type: TodoRecurrenceType,
    ) -> None:
        if is_subtask and recurrence_type != "none":
            raise SubtaskRecurrenceNotAllowedError(
                "サブタスクには繰り返し設定できません"
            )

    def _validate_update(
        self, owner_id: int, data: TodoUpdate, todo: Todo, exclude_id: int
    ) -> ValidatedTodoUpdate:
        if "name" in data.model_fields_set and data.name is not None:
            self._ensure_name_unique(owner_id, data.name, exclude_id=exclude_id)

        due_date = cast(
            date | None,
            data.due_date if "due_date" in data.model_fields_set else todo.due_date,
        )
        recurrence_type = cast(
            TodoRecurrenceType,
            data.recurrence_type
            if "recurrence_type" in data.model_fields_set
            and data.recurrence_type is not None
            else todo.recurrence_type,
        )
        self._validate_recurrence_due_date(due_date, recurrence_type)
        self._validate_subtask_recurrence(
            is_subtask=todo.parent_id is not None,
            recurrence_type=recurrence_type,
        )

        if self._is_transitioning_to_completed(todo, data):
            self._validate_parent_completion(todo, owner_id)

        return ValidatedTodoUpdate(data)

    def _validate_recurrence_due_date(
        self,
        due_date: date | None,
        recurrence_type: TodoRecurrenceType,
    ) -> None:
        if recurrence_type != "none" and due_date is None:
            raise RequiredFieldError(
                "Due date is required for recurring tasks",
                field="dueDate",
            )

    def _is_transitioning_to_completed(
        self, current_todo: Todo, update_data: TodoUpdate
    ) -> bool:
        """更新リクエストがprogress_statusを未完了→完了に変更しようとしているか"""
        if (
            "progress_status" not in update_data.model_fields_set
            or update_data.progress_status != "completed"
        ):
            return False
        current_status = cast(TodoProgressStatus, current_todo.progress_status)
        return current_status != "completed"

    def _is_completion_transition(self, todo: Todo, was_completed: bool) -> bool:
        progress_status = cast(TodoProgressStatus, todo.progress_status)
        is_completed = progress_status == "completed"
        recurrence_type = cast(TodoRecurrenceType, todo.recurrence_type)
        due_date = cast(date | None, todo.due_date)
        return (
            not was_completed
            and is_completed
            and recurrence_type != "none"
            and due_date is not None
        )

    def _calculate_next_due_date(
        self,
        recurrence_type: TodoRecurrenceType,
        base_date: date,
    ) -> date:
        if recurrence_type == "daily":
            return base_date + timedelta(days=1)
        if recurrence_type == "weekly":
            return base_date + timedelta(days=7)
        if recurrence_type == "monthly":
            return self._add_one_month(base_date)
        return base_date

    def _add_one_month(self, value: date) -> date:
        year = value.year + 1 if value.month == 12 else value.year
        month = 1 if value.month == 12 else value.month + 1
        day = min(value.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def _create_todo_entity(self, data: ValidatedTodoData, owner_id: int) -> Todo:
        """ValidatedTodoData からTodoエンティティを作成する"""
        return Todo(
            name=data.name,
            detail=data.detail or "",
            due_date=data.due_date,
            owner_id=owner_id,
            progress_status=data.progress_status,
            recurrence_type=data.recurrence_type,
            parent_id=data.parent_id,
        )

    def _apply_update(self, todo: Todo, data: ValidatedTodoUpdate) -> None:
        """更新対象のフィールドのみをTodoエンティティに反映する"""
        if "name" in data.model_fields_set and data.name is not None:
            todo.name = data.name
        if "detail" in data.model_fields_set:
            todo.detail = data.detail or ""
        if "due_date" in data.model_fields_set:
            todo.due_date = data.due_date
        if (
            "progress_status" in data.model_fields_set
            and data.progress_status is not None
        ):
            todo.progress_status = data.progress_status
        if (
            "recurrence_type" in data.model_fields_set
            and data.recurrence_type is not None
        ):
            todo.recurrence_type = data.recurrence_type

    def _calculate_subtask_progress(self, todo: Todo, owner_id: int) -> None:
        todo_id = cast(int, todo.id)
        total_subtask_count = self.repo.count_subtasks(todo_id, owner_id)
        completed_subtask_count = self.repo.count_completed_subtasks(todo_id, owner_id)
        progress_percent = (
            int((completed_subtask_count * 100) / total_subtask_count)
            if total_subtask_count > 0
            else 0
        )
        todo.completed_subtask_count = completed_subtask_count
        todo.total_subtask_count = total_subtask_count
        todo.subtask_progress_percent = progress_percent

    def _validate_parent_completion(self, todo: Todo, owner_id: int) -> None:
        if todo.parent_id is not None:
            return
        todo_id = cast(int, todo.id)
        if self.repo.has_incomplete_subtasks(todo_id, owner_id):
            raise ParentTodoCompletionBlockedError(
                "未完了のサブタスクがあるため完了できません"
            )

    def create_todo(self, data: TodoCreate, owner_id: int) -> Todo:
        validated = self._validate_todo(owner_id, data)

        todo = self._create_todo_entity(validated, owner_id)
        self.repo.create(todo)
        self.db.commit()
        self.db.refresh(todo)
        return todo

    def get_todo(self, todo_id: int, owner_id: int) -> Todo:
        todo = self.repo.get(todo_id, owner_id)
        if not todo:
            raise NotFoundError("Todo not found")
        self._calculate_subtask_progress(todo, owner_id)
        return todo

    def update_todo(self, todo_id: int, data: TodoUpdate, owner_id: int) -> Todo:
        todo = self.get_todo(todo_id, owner_id)
        was_completed = cast(TodoProgressStatus, todo.progress_status) == "completed"

        update_data = self._validate_update(owner_id, data, todo, exclude_id=todo_id)
        self._apply_update(todo, update_data)

        self.db.flush()

        if self._is_completion_transition(todo, was_completed):
            next_due_date = self._calculate_next_due_date(
                cast(TodoRecurrenceType, todo.recurrence_type),
                date.today(),
            )
            self.repo.create_recurrence_successor(todo, next_due_date)

        self.db.commit()
        self.db.refresh(todo)
        return todo

    def delete_todo(self, todo_id: int, owner_id: int) -> None:
        todo = self.get_todo(todo_id, owner_id)
        self.repo.delete(todo)
        self.db.commit()
