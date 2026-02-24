import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-for-jwt")
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./todo.db")

# JWT設定
JWT_SECRET_KEY = SECRET_KEY
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7日間
