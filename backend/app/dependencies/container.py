from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.todo import TodoRepository
from app.repositories.user import UserRepository
from app.services.todo import TodoService
from app.services.auth import AuthService


def get_todo_service(db: Session = Depends(get_db)) -> TodoService:
    repo = TodoRepository(db)
    return TodoService(db, repo)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    repo = UserRepository(db)
    return AuthService(db, repo)
