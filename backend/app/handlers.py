"""
例外ハンドラー

FastAPIのグローバル例外ハンドラーを定義
"""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from typing import Union

from app.schemas.errors import (
    ValidationErrorResponse,
    RequiredError,
    MaxLengthError,
    MinLengthError,
    UniqueViolationError,
    InvalidFormatError,
)
from app.exceptions import DuplicateError, RequiredFieldError


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pydanticバリデーションエラーを構造化レスポンスに変換"""
    errors: list[
        Union[RequiredError, MaxLengthError, MinLengthError, InvalidFormatError]
    ] = []

    for error in exc.errors():
        field = error["loc"][-1] if error["loc"] else "unknown"
        error_type = error["type"]

        if error_type == "missing" or error_type == "required":
            errors.append(RequiredError(field=str(field)))
        elif error_type in {"string_too_short", "too_short"}:
            ctx = error.get("ctx", {})
            limit = ctx.get("min_length", 1)
            errors.append(MinLengthError(field=str(field), limit=limit))
        elif error_type in {"string_too_long", "too_long"}:
            ctx = error.get("ctx", {})
            limit = ctx.get("max_length", 0)
            errors.append(MaxLengthError(field=str(field), limit=limit))
        elif error_type == "invalid_format":
            errors.append(InvalidFormatError(field=str(field)))
        else:
            # その他のバリデーションエラーは将来的に追加
            # 現時点では無視
            pass

    error_response = ValidationErrorResponse(
        status=422,
        detail="Validation error",
        errors=errors,
    )

    return JSONResponse(
        status_code=422,
        content=error_response.model_dump(),
    )


async def duplicate_exception_handler(
    request: Request, exc: DuplicateError
) -> JSONResponse:
    """DuplicateErrorを構造化レスポンスに変換"""
    error_response = ValidationErrorResponse(
        status=422,
        detail="Validation error",
        errors=[UniqueViolationError(field=exc.field)],
    )

    return JSONResponse(
        status_code=422,
        content=error_response.model_dump(),
    )


async def required_field_exception_handler(
    request: Request, exc: RequiredFieldError
) -> JSONResponse:
    """RequiredFieldErrorを構造化レスポンスに変換"""
    error_response = ValidationErrorResponse(
        status=422,
        detail="Validation error",
        errors=[RequiredError(field=exc.field)],
    )

    return JSONResponse(
        status_code=422,
        content=error_response.model_dump(),
    )
