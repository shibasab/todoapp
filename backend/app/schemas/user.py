from pydantic import BaseModel, EmailStr
from typing import Optional
from pydantic.config import ConfigDict


class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None


class UserCreate(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    user: UserResponse
    token: str
