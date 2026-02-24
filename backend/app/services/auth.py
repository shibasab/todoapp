from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from jose import jwt

from app.models.user import User
from app.schemas.user import UserCreate
from app.repositories.user import UserRepository
from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
from app.exceptions import DuplicateError, AuthenticationError, NotFoundError


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWTアクセストークンを作成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


class AuthService:
    def __init__(self, db: Session, repo: UserRepository):
        self.db = db
        self.repo = repo

    def register(self, data: UserCreate) -> Tuple[User, str]:
        """ユーザー登録を行い、トークンを生成する"""
        # ユーザー名の重複チェック
        existing_user = self.repo.get_by_username(data.username)
        if existing_user:
            raise DuplicateError("Username already registered")

        # ユーザー作成
        user = User(
            username=data.username,
            email=data.email or "",
        )
        user.set_password(data.password)
        self.repo.create(user)
        self.db.commit()
        self.db.refresh(user)

        # トークン生成
        token = create_access_token(data={"sub": str(user.id)})

        return user, token

    def login(self, username: str, password: str) -> Tuple[User, str]:
        """ログインを行い、トークンを生成する"""
        user = self.repo.get_by_username(username)
        if not user or not user.check_password(password):
            raise AuthenticationError("Incorrect Credentials")

        # トークン生成
        token = create_access_token(data={"sub": str(user.id)})

        return user, token

    def get_user(self, user_id: int) -> User:
        """ユーザー情報を取得する"""
        user = self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        return user
