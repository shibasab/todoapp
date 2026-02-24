"""
認証APIのテスト
"""


class TestRegister:
    """ユーザー登録のテスト"""

    def test_register_success(self, client):
        """新規ユーザー登録が成功し、トークンが返される"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "newuser",
                "password": "newpassword123",
                "email": "newuser@example.com",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "newuser"
        assert data["user"]["email"] == "newuser@example.com"

    def test_register_duplicate_username(self, client, test_user):
        """既存ユーザー名で登録すると400エラー"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",  # test_userと同じユーザー名
                "password": "anotherpassword123",
                "email": "another@example.com",
            },
        )

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]


class TestLogin:
    """ログインのテスト"""

    def test_login_success(self, client, test_user):
        """正しい認証情報でログイン成功"""
        response = client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "testpassword123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "testuser"

    def test_login_wrong_password(self, client, test_user):
        """不正なパスワードで400エラー"""
        response = client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "wrongpassword"},
        )

        assert response.status_code == 400
        assert "Incorrect Credentials" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        """存在しないユーザーで400エラー"""
        response = client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "somepassword"},
        )

        assert response.status_code == 400


class TestAuthenticatedEndpoints:
    """認証済みエンドポイントのテスト"""

    def test_logout_success(self, client, auth_headers):
        """認証済みユーザーはログアウト成功レスポンスを受け取れる"""
        response = client.post("/api/auth/logout", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == {"detail": "Successfully logged out"}

    def test_get_user_success(self, client, test_user, auth_headers):
        """認証済みユーザーは自分の情報を取得できる"""
        response = client.get("/api/auth/user", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == {
            "id": test_user.id,
            "username": "testuser",
            "email": "test@example.com",
        }

    def test_get_user_with_invalid_token_returns_401(self, client):
        """不正なJWTでは401エラー"""
        response = client.get(
            "/api/auth/user",
            headers={"Authorization": "Bearer invalid.token.value"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"

    def test_get_user_without_sub_claim_returns_401(self, client):
        """subクレームがないJWTでは401エラー"""
        from app.services.auth import create_access_token

        token = create_access_token(data={"scope": "read"})
        response = client.get(
            "/api/auth/user",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"

    def test_get_user_inactive_user_returns_401(self, client, test_db, test_user):
        """非アクティブユーザーのトークンでは401エラー"""
        from app.services.auth import create_access_token

        test_user.is_active = False
        test_db.commit()

        token = create_access_token(data={"sub": str(test_user.id)})
        response = client.get(
            "/api/auth/user",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"
