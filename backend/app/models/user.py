from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(254), default="")
    hashed_password: Mapped[str] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(default=True)

    def set_password(self, password: str) -> None:
        """パスワードをハッシュ化して設定"""
        self.hashed_password = pwd_context.hash(password)

    def check_password(self, password: str) -> bool:
        """パスワードを検証"""
        return pwd_context.verify(password, self.hashed_password)  # pyrefly: ignore
