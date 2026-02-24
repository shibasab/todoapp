from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.user import User
from app.schemas.todo import TodoCreate, TodoResponse, TodoUpdate, TodoProgressStatus
from app.dependencies.auth import get_current_user
from app.dependencies.container import get_todo_service
from app.services.todo import TodoService
from app.exceptions import (
    NotFoundError,
    InvalidParentTodoError,
    ParentTodoCompletionBlockedError,
    SubtaskRecurrenceNotAllowedError,
)

router = APIRouter()


@router.get("/", response_model=List[TodoResponse])
def list_todos(
    keyword_param: str | None = Query(default=None, alias="keyword"),
    progress_status_param: TodoProgressStatus | None = Query(
        default=None,
        alias="progress_status",
    ),
    due_date_param: Literal["all", "today", "this_week", "overdue", "none"] | None = (
        Query(
            default=None,
            alias="due_date",
        )
    ),
    current_user: User = Depends(get_current_user),
    service: TodoService = Depends(get_todo_service),
):
    """現在のユーザーのTodo一覧を取得"""
    todos = service.get_todos(
        current_user.id,  # pyrefly: ignore[bad-argument-type]
        keyword=keyword_param,
        progress_status=progress_status_param,
        due_date=due_date_param,
    )
    return [TodoResponse.model_validate(todo) for todo in todos]


@router.post("/", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo_data: TodoCreate,
    current_user: User = Depends(get_current_user),
    service: TodoService = Depends(get_todo_service),
):
    """Todoを作成"""
    try:
        todo = service.create_todo(
            todo_data,
            current_user.id,  # pyrefly: ignore[bad-argument-type]
        )
        return TodoResponse.model_validate(todo)
    except (InvalidParentTodoError, SubtaskRecurrenceNotAllowedError) as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.get("/{todo_id}/", response_model=TodoResponse)
def get_todo(
    todo_id: int,
    current_user: User = Depends(get_current_user),
    service: TodoService = Depends(get_todo_service),
):
    """Todoを取得"""
    try:
        todo = service.get_todo(
            todo_id,
            current_user.id,  # pyrefly: ignore[bad-argument-type]
        )
        return TodoResponse.model_validate(todo)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.put("/{todo_id}/", response_model=TodoResponse)
def update_todo(
    todo_id: int,
    todo_data: TodoUpdate,
    current_user: User = Depends(get_current_user),
    service: TodoService = Depends(get_todo_service),
):
    """Todoを更新（部分更新）"""
    try:
        todo = service.update_todo(
            todo_id,
            todo_data,
            current_user.id,  # pyrefly: ignore[bad-argument-type]
        )
        return TodoResponse.model_validate(todo)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except (ParentTodoCompletionBlockedError, SubtaskRecurrenceNotAllowedError) as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.delete("/{todo_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    current_user: User = Depends(get_current_user),
    service: TodoService = Depends(get_todo_service),
):
    """Todoを削除"""
    try:
        service.delete_todo(
            todo_id,
            current_user.id,  # pyrefly: ignore[bad-argument-type]
        )
        return None
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
