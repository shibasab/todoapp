from app.models.todo import Todo


class TestTodoDeadline:
    """期限設定機能のテスト（dueDate形式）"""

    def test_create_todo_with_deadline(self, client, auth_headers):
        """期限日付きタスクの作成"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Deadline Task",
                "detail": "With deadline",
                "dueDate": "2026-12-31",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["dueDate"] == "2026-12-31"
        assert "due_date" not in data

    def test_put_todo_with_deadline(self, client, auth_headers, test_user, test_db):
        """PUTで期限日を含むタスク全体を更新"""
        todo = Todo(name="Original Task", detail="Original", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={
                "name": "Updated Task",
                "detail": "Updated detail",
                "dueDate": "2026-11-15",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Task"
        assert data["detail"] == "Updated detail"
        assert data["dueDate"] == "2026-11-15"

    def test_put_todo_remove_deadline(self, client, auth_headers, test_user, test_db):
        """PUTで期限日を削除（nullを送信）"""
        from datetime import date

        todo = Todo(
            name="Task with Deadline",
            detail="Some detail",
            due_date=date(2026, 12, 31),
            owner_id=test_user.id,
        )
        test_db.add(todo)
        test_db.commit()

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={
                "name": "Task with Deadline",
                "detail": "Some detail",
                "dueDate": None,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["dueDate"] is None

    def test_create_todo_invalid_deadline_format(self, client, auth_headers):
        """期限日の形式エラー（不正な日付文字列）"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Invalid Deadline Task",
                "dueDate": "not-a-date",
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert data["errors"][0]["field"] == "dueDate"
        assert data["errors"][0]["reason"] == "invalid_format"

    def test_create_todo_invalid_date_value(self, client, auth_headers):
        """期限日の値エラー（存在しない日付）"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Invalid Date Value",
                "dueDate": "2026-02-30",
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert data["errors"][0]["field"] == "dueDate"
        assert data["errors"][0]["reason"] == "invalid_format"
