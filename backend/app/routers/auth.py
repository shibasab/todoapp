from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.dependencies.auth import get_current_user
from app.dependencies.container import get_auth_service
from app.services.auth import AuthService
from app.exceptions import DuplicateError, AuthenticationError

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(
    user_data: UserCreate,
    service: AuthService = Depends(get_auth_service),
):
    """ユーザー登録"""
    try:
        user, token = service.register(user_data)

        return TokenResponse(
            user=UserResponse(
                id=user.id,  # pyrefly: ignore[bad-argument-type]
                username=user.username,  # pyrefly: ignore[bad-argument-type]
                email=user.email,  # pyrefly: ignore[bad-argument-type]
            ),
            token=token,
        )
    except DuplicateError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from None


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: UserLogin,
    service: AuthService = Depends(get_auth_service),
):
    """ログイン"""
    try:
        user, token = service.login(credentials.username, credentials.password)

        return TokenResponse(
            user=UserResponse(
                id=user.id,  # pyrefly: ignore[bad-argument-type]
                username=user.username,  # pyrefly: ignore[bad-argument-type]
                email=user.email,  # pyrefly: ignore[bad-argument-type]
            ),
            token=token,
        )
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from None


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """ログアウト"""
    return {"detail": "Successfully logged out"}


@router.get("/user", response_model=UserResponse)
def get_user(current_user: User = Depends(get_current_user)):
    """ユーザー情報を取得"""
    return UserResponse(
        id=current_user.id,  # pyrefly: ignore[bad-argument-type]
        username=current_user.username,  # pyrefly: ignore[bad-argument-type]
        email=current_user.email,  # pyrefly: ignore[bad-argument-type]
    )
