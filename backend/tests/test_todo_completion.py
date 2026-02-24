"""
タスク進捗ステータス機能のテスト
"""

from app.models.todo import Todo
from app.models.user import User


class TestTodoProgressStatus:
    """進捗ステータス機能のテスト"""

    def test_create_todo_default_not_started(self, client, auth_headers):
        """progressStatusを省略した場合はnot_startedがデフォルト"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "New Task", "detail": "Some detail"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["progressStatus"] == "not_started"

    def test_create_todo_with_progress_status(self, client, auth_headers):
        """progressStatusを明示的に指定して作成できる"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "In Progress Task",
                "detail": "Some detail",
                "progressStatus": "in_progress",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["progressStatus"] == "in_progress"

    def test_update_todo_to_completed(self, client, auth_headers, test_user, test_db):
        """タスクをcompletedに更新できる"""
        todo = Todo(
            name="Task to Complete",
            detail="Some detail",
            owner_id=test_user.id,
            progress_status="not_started",
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["progressStatus"] == "completed"

    def test_update_todo_to_not_started(self, client, auth_headers, test_user, test_db):
        """completedをnot_startedに戻せる"""
        todo = Todo(
            name="Completed Task",
            detail="Some detail",
            owner_id=test_user.id,
            progress_status="completed",
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"progressStatus": "not_started"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["progressStatus"] == "not_started"

    def test_update_omits_progress_status_keeps_value(
        self, client, auth_headers, test_user, test_db
    ):
        """progressStatus未送信でも進捗状態が維持される"""
        todo = Todo(
            name="Original Name",
            detail="Original detail",
            owner_id=test_user.id,
            progress_status="completed",
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"detail": "Updated detail"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Name"
        assert data["detail"] == "Updated detail"
        assert data["progressStatus"] == "completed"

    def test_list_todos_includes_progress_status(
        self, client, auth_headers, test_user, test_db
    ):
        """タスク一覧にprogressStatusフィールドが含まれる"""
        todo_not_started = Todo(
            name="Not Started Task",
            owner_id=test_user.id,
            progress_status="not_started",
        )
        todo_completed = Todo(
            name="Completed Task",
            owner_id=test_user.id,
            progress_status="completed",
        )
        test_db.add_all([todo_not_started, todo_completed])
        test_db.commit()

        response = client.get("/api/todo/", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        statuses = {item["name"]: item["progressStatus"] for item in data}
        assert statuses["Not Started Task"] == "not_started"
        assert statuses["Completed Task"] == "completed"

    def test_get_todo_includes_progress_status(
        self, client, auth_headers, test_user, test_db
    ):
        """タスク取得時にprogressStatusフィールドが含まれる"""
        todo = Todo(
            name="Single Task",
            detail="Some detail",
            owner_id=test_user.id,
            progress_status="completed",
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.get(f"/api/todo/{todo.id}/", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["progressStatus"] == "completed"

    def test_cannot_update_others_todo_progress_status(
        self, client, auth_headers, test_user, test_db
    ):
        """他ユーザーのタスク進捗を変更しようとすると404"""
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("otherpassword")
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)

        other_todo = Todo(
            name="Other's Task",
            detail="Other's detail",
            owner_id=other_user.id,
            progress_status="not_started",
        )
        test_db.add(other_todo)
        test_db.commit()
        test_db.refresh(other_todo)

        response = client.put(
            f"/api/todo/{other_todo.id}/",
            headers=auth_headers,
            json={
                "name": "Other's Task",
                "detail": "Other's detail",
                "progressStatus": "completed",
            },
        )

        assert response.status_code == 404
