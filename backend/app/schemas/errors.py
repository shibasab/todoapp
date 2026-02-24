from typing import Literal, List, Optional, Union
from pydantic import BaseModel, ConfigDict


class ValidationErrorItemBase(BaseModel):
    field: str


class RequiredError(ValidationErrorItemBase):
    reason: Literal["required"] = "required"


class UniqueViolationError(ValidationErrorItemBase):
    reason: Literal["unique_violation"] = "unique_violation"


class MaxLengthError(ValidationErrorItemBase):
    reason: Literal["max_length"] = "max_length"
    limit: int


class MinLengthError(ValidationErrorItemBase):
    reason: Literal["min_length"] = "min_length"
    limit: int


class InvalidFormatError(ValidationErrorItemBase):
    reason: Literal["invalid_format"] = "invalid_format"


ValidationError = Union[
    RequiredError,
    UniqueViolationError,
    MaxLengthError,
    MinLengthError,
    InvalidFormatError,
]


class ErrorResponseBase(BaseModel):
    status: int
    detail: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class ValidationErrorResponse(ErrorResponseBase):
    type: Literal["validation_error"] = "validation_error"
    errors: List[ValidationError]


ErrorResponse = Union[ValidationErrorResponse]
