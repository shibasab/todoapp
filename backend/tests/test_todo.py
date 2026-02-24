"""
Todo APIのテスト
"""

from datetime import date, timedelta

from app.models.user import User
from app.models.todo import Todo


class TestCreateTodo:
    """Todo作成のテスト"""

    def test_create_todo(self, client, auth_headers):
        """認証済みユーザーがTodo作成できる"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "Test Task", "detail": "Test Detail"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Task"
        assert data["detail"] == "Test Detail"
        assert "id" in data
        assert "created_at" in data

    def test_create_todo_without_auth(self, client):
        """認証なしでTodo作成すると403エラー"""
        response = client.post(
            "/api/todo/", json={"name": "Test Task", "detail": "Test Detail"}
        )

        assert response.status_code == 401

    def test_create_duplicate_todo_name_fails(
        self, client, auth_headers, test_user, test_db
    ):
        """同じ名前のタスク作成で422エラー（バリデーションエラー）"""
        # 最初のTodoを作成
        todo = Todo(name="Duplicate Task", detail="First one", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()

        # 同じ名前で作成しようとする
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "Duplicate Task", "detail": "Second one"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "unique_violation"

    def test_create_todo_allows_name_reuse_if_existing_task_completed(
        self, client, auth_headers, test_user, test_db
    ):
        completed = Todo(
            name="Reusable Name",
            detail="done",
            owner_id=test_user.id,
            progress_status="completed",
        )
        test_db.add(completed)
        test_db.commit()

        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "Reusable Name", "detail": "new"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Reusable Name"

    def test_create_todo_name_too_long(self, client, auth_headers):
        """タスク名が100文字を超える場合は422エラー"""
        long_name = "a" * 101
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": long_name, "detail": "Test Detail"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "max_length"
        assert data["errors"][0]["limit"] == 100

    def test_create_todo_detail_too_long(self, client, auth_headers):
        """タスク詳細が500文字を超える場合は422エラー"""
        long_detail = "a" * 501
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "Test Task", "detail": long_detail},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "detail"
        assert data["errors"][0]["reason"] == "max_length"
        assert data["errors"][0]["limit"] == 500

    def test_create_todo_name_empty(self, client, auth_headers):
        """タスク名が空の場合は422エラー"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "", "detail": "Test Detail"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "required"

    def test_create_todo_name_missing(self, client, auth_headers):
        """タスク名フィールドが欠落している場合は422エラー"""
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"detail": "Test Detail"},  # nameフィールドなし
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "required"


class TestListTodos:
    """Todo一覧取得のテスト"""

    def test_list_own_todos(self, client, auth_headers, test_user, test_db):
        """自分のTodoのみが一覧に表示される"""
        # テストユーザーのTodoを作成
        todo = Todo(name="My Task", detail="My Detail", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()

        response = client.get("/api/todo/", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "My Task"


class TestTodoSearchFilters:
    """Todo検索・フィルタリングのテスト"""

    def test_search_keyword_matches_name_and_detail(
        self, client, auth_headers, test_user, test_db
    ):
        todo_match_name = Todo(
            name="Alpha Task",
            detail="Detail",
            owner_id=test_user.id,
        )
        todo_match_detail = Todo(
            name="Bravo Task",
            detail="Contains Alpha keyword",
            owner_id=test_user.id,
        )
        todo_unmatched = Todo(
            name="Charlie Task",
            detail="No match here",
            owner_id=test_user.id,
        )
        test_db.add_all([todo_match_name, todo_match_detail, todo_unmatched])
        test_db.commit()

        response = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"keyword": "Alpha"},
        )

        assert response.status_code == 200
        names = {item["name"] for item in response.json()}
        assert names == {"Alpha Task", "Bravo Task"}

    def test_search_keyword_is_partial_match(
        self, client, auth_headers, test_user, test_db
    ):
        todo_one = Todo(name="Write Report", detail="", owner_id=test_user.id)
        todo_two = Todo(name="Review Report", detail="", owner_id=test_user.id)
        todo_three = Todo(name="Plan Meeting", detail="", owner_id=test_user.id)
        test_db.add_all([todo_one, todo_two, todo_three])
        test_db.commit()

        response = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"keyword": "Report"},
        )

        assert response.status_code == 200
        names = {item["name"] for item in response.json()}
        assert names == {"Write Report", "Review Report"}

    def test_filters_status_and_due_date(
        self, client, auth_headers, test_user, test_db
    ):
        today = date.today()
        overdue = today - timedelta(days=1)
        within_week = today + timedelta(days=3)

        todo_completed = Todo(
            name="Completed Task",
            detail="",
            owner_id=test_user.id,
            progress_status="completed",
            due_date=within_week,
        )
        todo_incomplete_overdue = Todo(
            name="Overdue Task",
            detail="",
            owner_id=test_user.id,
            progress_status="not_started",
            due_date=overdue,
        )
        todo_no_due = Todo(
            name="No Due Task",
            detail="",
            owner_id=test_user.id,
            progress_status="not_started",
            due_date=None,
        )
        test_db.add_all([todo_completed, todo_incomplete_overdue, todo_no_due])
        test_db.commit()

        response_completed = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"progress_status": "completed"},
        )

        assert response_completed.status_code == 200
        completed_names = {item["name"] for item in response_completed.json()}
        assert completed_names == {"Completed Task"}

        response_overdue = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"due_date": "overdue"},
        )

        assert response_overdue.status_code == 200
        overdue_names = {item["name"] for item in response_overdue.json()}
        assert overdue_names == {"Overdue Task"}

        response_none = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"due_date": "none"},
        )

        assert response_none.status_code == 200
        none_names = {item["name"] for item in response_none.json()}
        assert none_names == {"No Due Task"}

    def test_search_keyword_escapes_like_wildcards(
        self, client, auth_headers, test_user, test_db
    ):
        todo_percent = Todo(
            name="Save 100% Coverage",
            detail="",
            owner_id=test_user.id,
        )
        todo_percent_unexpected = Todo(
            name="Save 100X Coverage",
            detail="",
            owner_id=test_user.id,
        )
        todo_underscore = Todo(
            name="test_abc",
            detail="",
            owner_id=test_user.id,
        )
        todo_underscore_unexpected = Todo(
            name="testXabc",
            detail="",
            owner_id=test_user.id,
        )
        test_db.add_all(
            [
                todo_percent,
                todo_percent_unexpected,
                todo_underscore,
                todo_underscore_unexpected,
            ]
        )
        test_db.commit()

        response_percent = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"keyword": "100%"},
        )

        assert response_percent.status_code == 200
        percent_names = {item["name"] for item in response_percent.json()}
        assert percent_names == {"Save 100% Coverage"}

        response_underscore = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"keyword": "test_abc"},
        )

        assert response_underscore.status_code == 200
        underscore_names = {item["name"] for item in response_underscore.json()}
        assert underscore_names == {"test_abc"}

    def test_cannot_see_others_todos(self, client, auth_headers, test_user, test_db):
        """他人のTodoは一覧に表示されない"""
        # 別のユーザーを作成
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("otherpassword")
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)

        # 別のユーザーのTodoを作成
        other_todo = Todo(
            name="Other's Task", detail="Other's Detail", owner_id=other_user.id
        )
        test_db.add(other_todo)
        test_db.commit()

        # テストユーザーで取得
        response = client.get("/api/todo/", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0  # 他人のTodoは見えない

    def test_list_todos_accepts_search_filters(
        self, client, auth_headers, test_user, test_db
    ):
        """検索・フィルタ用のクエリパラメータを受け付ける"""
        todo = Todo(name="My Task", detail="My Detail", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()

        response = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={
                "keyword": "My",
                "progress_status": "completed",
                "due_date": "all",
            },
        )

        assert response.status_code == 200


class TestAccessOthersTodo:
    """他人のTodoへのアクセス制限テスト"""

    def test_cannot_access_others_todo(self, client, auth_headers, test_user, test_db):
        """他人のTodoにアクセスすると404"""
        # 別のユーザーを作成
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("otherpassword")
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)

        # 別のユーザーのTodoを作成
        other_todo = Todo(
            name="Other's Task", detail="Other's Detail", owner_id=other_user.id
        )
        test_db.add(other_todo)
        test_db.commit()
        test_db.refresh(other_todo)

        # テストユーザーでアクセス
        response = client.get(f"/api/todo/{other_todo.id}/", headers=auth_headers)

        assert response.status_code == 404


class TestUpdateTodo:
    """Todo更新のテスト"""

    def test_update_todo(self, client, auth_headers, test_user, test_db):
        """Todoの更新が正しく動作"""
        # Todoを作成
        todo = Todo(
            name="Original Task", detail="Original Detail", owner_id=test_user.id
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        # 更新
        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": "Updated Task", "detail": "Updated Detail"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Task"
        assert data["detail"] == "Updated Detail"

    def test_update_to_duplicate_name_fails(
        self, client, auth_headers, test_user, test_db
    ):
        """他のタスクと重複する名前への更新で422エラー（バリデーションエラー）"""
        # 2つのTodoを作成
        todo1 = Todo(name="Task One", detail="First task", owner_id=test_user.id)
        todo2 = Todo(name="Task Two", detail="Second task", owner_id=test_user.id)
        test_db.add(todo1)
        test_db.add(todo2)
        test_db.commit()
        test_db.refresh(todo1)
        test_db.refresh(todo2)

        # todo2をtodo1と同じ名前に更新しようとする
        response = client.put(
            f"/api/todo/{todo2.id}/",
            headers=auth_headers,
            json={"name": "Task One", "detail": "Trying to duplicate"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "unique_violation"

    def test_update_name_can_match_completed_task_name(
        self, client, auth_headers, test_user, test_db
    ):
        completed = Todo(
            name="Completed Name",
            detail="done",
            owner_id=test_user.id,
            progress_status="completed",
        )
        editing = Todo(name="Editing Task", detail="todo", owner_id=test_user.id)
        test_db.add_all([completed, editing])
        test_db.commit()
        test_db.refresh(editing)

        response = client.put(
            f"/api/todo/{editing.id}/",
            headers=auth_headers,
            json={"name": "Completed Name", "detail": "updated"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Completed Name"

    def test_update_same_name_succeeds(self, client, auth_headers, test_user, test_db):
        """同じ名前のまま他フィールドを更新して成功"""
        # Todoを作成
        todo = Todo(name="Keep Name", detail="Original detail", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        # 名前はそのままで詳細だけ更新
        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": "Keep Name", "detail": "Updated detail"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Keep Name"
        assert data["detail"] == "Updated detail"

    def test_different_users_can_have_same_task_name(
        self, client, auth_headers, test_user, test_db
    ):
        """異なるユーザーは同じ名前のタスクを作成可能"""
        # テストユーザーのTodoを作成
        todo1 = Todo(name="Same Name", detail="User 1 task", owner_id=test_user.id)
        test_db.add(todo1)
        test_db.commit()

        # 別のユーザーを作成
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("otherpassword")
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(other_user)

        # 別のユーザーで同じ名前のTodoを作成
        todo2 = Todo(name="Same Name", detail="User 2 task", owner_id=other_user.id)
        test_db.add(todo2)
        test_db.commit()  # これがエラーなく成功することを確認

        # 両方のTodoが存在することを確認
        assert test_db.query(Todo).filter(Todo.name == "Same Name").count() == 2

    def test_update_todo_name_too_long(self, client, auth_headers, test_user, test_db):
        """タスク名が100文字を超える場合は422エラー"""
        # Todoを作成
        todo = Todo(name="Original Task", detail="Original", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        long_name = "a" * 101
        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": long_name, "detail": "Test Detail"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "max_length"
        assert data["errors"][0]["limit"] == 100

    def test_update_todo_detail_too_long(
        self, client, auth_headers, test_user, test_db
    ):
        """タスク詳細が500文字を超える場合は422エラー"""
        # Todoを作成
        todo = Todo(name="Original Task", detail="Original", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        long_detail = "a" * 501
        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": "Test Task", "detail": long_detail},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "detail"
        assert data["errors"][0]["reason"] == "max_length"
        assert data["errors"][0]["limit"] == 500

    def test_update_todo_name_empty(self, client, auth_headers, test_user, test_db):
        """タスク名が空の場合は422エラー"""
        # Todoを作成
        todo = Todo(name="Original Task", detail="Original", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": "", "detail": "Test Detail"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert len(data["errors"]) == 1
        assert data["errors"][0]["field"] == "name"
        assert data["errors"][0]["reason"] == "required"

    def test_update_todo_name_missing(self, client, auth_headers, test_user, test_db):
        """タスク名フィールドが欠落している場合でも他フィールドを更新できる"""
        # Todoを作成
        todo = Todo(name="Original Task", detail="Original", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"detail": "Test Detail"},  # nameフィールドなし
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Task"
        assert data["detail"] == "Test Detail"

    def test_update_todo_preserves_fields_when_omitted(
        self, client, auth_headers, test_user, test_db
    ):
        """未指定のフィールドは既存値を保持する"""
        todo = Todo(
            name="Original Task",
            detail="Original detail",
            owner_id=test_user.id,
            due_date=None,
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        response = client.put(
            f"/api/todo/{todo.id}/",
            headers=auth_headers,
            json={"name": "Updated Task"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Task"
        assert data["detail"] == "Original detail"
        assert data["dueDate"] is None


class TestDeleteTodo:
    """Todo削除のテスト"""

    def test_delete_todo(self, client, auth_headers, test_user, test_db):
        """Todoの削除が正しく動作"""
        # Todoを作成
        todo = Todo(name="To Delete", detail="Will be deleted", owner_id=test_user.id)
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)

        # 削除
        response = client.delete(f"/api/todo/{todo.id}/", headers=auth_headers)

        assert response.status_code == 204

        # 削除確認
        response = client.get(f"/api/todo/{todo.id}/", headers=auth_headers)
        assert response.status_code == 404
