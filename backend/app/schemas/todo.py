from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    AfterValidator,
    WrapValidator,
    BeforeValidator,
)
from pydantic_core import PydanticCustomError
from typing import Optional, Annotated, Literal
from datetime import datetime, date


# TODO: バリデーション処理を別ファイルに移動する
def validate_not_empty(v: str) -> str:
    """空文字列または空白のみの文字列を拒否するバリデーター"""
    if not v or not v.strip():
        raise PydanticCustomError(
            "required",
            "Field is required",
        )
    return v


def validate_date_format(v, handler):
    """日付フォーマットのバリデーション

    すべてのパースエラーをinvalid_formatに統一
    """
    try:
        return handler(v)
    except Exception:
        # すべての日付パースエラーを統一されたエラータイプに変換
        raise PydanticCustomError(
            "invalid_format",
            "Invalid date format",
        ) from None


def reject_null(v):
    """明示的なnullを拒否するバリデーター"""
    if v is None:
        raise PydanticCustomError(
            "null_not_allowed",
            "Null is not allowed",
        )
    return v


TODO_NAME_MAX_LENGTH = 100
TODO_DETAIL_MAX_LENGTH = 500

# 必須文字列型（空文字列を許可しない）
RequiredStr = Annotated[str, AfterValidator(validate_not_empty)]

# 検証済み日付型（すべてのパースエラーをinvalid_formatに統一）
ValidatedDate = Annotated[Optional[date], WrapValidator(validate_date_format)]

# 更新用のOptional型（明示的nullは拒否）
# - 部分更新では「未送信」と「null送信」を区別したい
# - OptionalRequiredStr は「値を送れば必須の検証を行うが、未送信なら許容する」を表す
OptionalRequiredStr = Annotated[Optional[RequiredStr], BeforeValidator(reject_null)]
OptionalStr = Annotated[Optional[str], BeforeValidator(reject_null)]
TodoRecurrenceType = Literal["none", "daily", "weekly", "monthly"]
TodoProgressStatus = Literal["not_started", "in_progress", "completed"]
OptionalRecurrenceType = Annotated[
    Optional[TodoRecurrenceType], BeforeValidator(reject_null)
]
OptionalProgressStatus = Annotated[
    Optional[TodoProgressStatus], BeforeValidator(reject_null)
]


class TodoBase(BaseModel):
    name: RequiredStr = Field(..., max_length=TODO_NAME_MAX_LENGTH)
    detail: str = Field(default="", max_length=TODO_DETAIL_MAX_LENGTH)
    due_date: ValidatedDate = Field(default=None, alias="dueDate")
    progress_status: TodoProgressStatus = Field(
        default="not_started", alias="progressStatus"
    )
    recurrence_type: TodoRecurrenceType = Field(default="none", alias="recurrenceType")


class TodoCreate(BaseModel):
    name: RequiredStr = Field(..., max_length=TODO_NAME_MAX_LENGTH)
    detail: str = Field(default="", max_length=TODO_DETAIL_MAX_LENGTH)
    parent_id: Optional[int] = Field(default=None, alias="parentId")
    due_date: ValidatedDate = Field(default=None, alias="dueDate")
    progress_status: TodoProgressStatus = Field(
        default="not_started", alias="progressStatus"
    )
    recurrence_type: TodoRecurrenceType = Field(default="none", alias="recurrenceType")


class TodoUpdate(BaseModel):
    model_config = ConfigDict(validate_default=False)

    name: OptionalRequiredStr = Field(default=None, max_length=TODO_NAME_MAX_LENGTH)
    detail: OptionalStr = Field(default=None, max_length=TODO_DETAIL_MAX_LENGTH)
    due_date: ValidatedDate = Field(default=None, alias="dueDate")
    progress_status: OptionalProgressStatus = Field(
        default=None, alias="progressStatus"
    )
    recurrence_type: OptionalRecurrenceType = Field(
        default=None, alias="recurrenceType"
    )


class TodoResponse(BaseModel):
    id: int
    name: RequiredStr = Field(..., max_length=TODO_NAME_MAX_LENGTH)
    detail: str = Field(default="", max_length=TODO_DETAIL_MAX_LENGTH)
    due_date: ValidatedDate = Field(default=None, alias="dueDate")
    progress_status: TodoProgressStatus = Field(
        default="not_started", alias="progressStatus"
    )
    recurrence_type: TodoRecurrenceType = Field(default="none", alias="recurrenceType")
    parent_id: Optional[int] = Field(default=None, alias="parentId")
    completed_subtask_count: int = Field(default=0, alias="completedSubtaskCount")
    total_subtask_count: int = Field(default=0, alias="totalSubtaskCount")
    subtask_progress_percent: int = Field(default=0, alias="subtaskProgressPercent")
    owner: Optional[int] = Field(default=None, validation_alias="owner_id")
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        validate_by_name=True,
        validate_by_alias=True,
    )
