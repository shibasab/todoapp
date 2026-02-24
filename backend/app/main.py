from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.database import engine, Base
from app.routers import auth, todo
from app.handlers import (
    validation_exception_handler,
    duplicate_exception_handler,
    required_field_exception_handler,
)
from app.exceptions import DuplicateError, RequiredFieldError

# データベーステーブルを作成
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Todo API",
    description="FastAPI + SQLAlchemy を使用したTodo API",
    version="2.0.0",
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 例外ハンドラーを登録
app.add_exception_handler(
    RequestValidationError,
    validation_exception_handler,  # pyrefly: ignore[bad-argument-type]
)
app.add_exception_handler(
    DuplicateError,
    duplicate_exception_handler,  # pyrefly: ignore[bad-argument-type]
)
app.add_exception_handler(
    RequiredFieldError,
    required_field_exception_handler,  # pyrefly: ignore[bad-argument-type]
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(todo.router, prefix="/api/todo", tags=["todo"])


@app.get("/")
async def root():
    """ヘルスチェック"""
    return {"message": "Todo API is running"}
