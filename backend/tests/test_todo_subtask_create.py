from app.models.todo import Todo


class TestCreateSubtask:
    def test_create_subtask_with_parent_id(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "子タスク", "parentId": parent.id},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "子タスク"
        assert data["parentId"] == parent.id

    def test_create_subtask_with_nonexistent_parent_returns_409(
        self, client, auth_headers
    ):
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "子タスク", "parentId": 99999},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "親タスクが存在しません"

    def test_create_subtask_with_subtask_parent_returns_409(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        child = Todo(
            name="子タスク", detail="", owner_id=test_user.id, parent_id=parent.id
        )
        test_db.add(child)
        test_db.commit()
        test_db.refresh(child)

        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "孫タスク", "parentId": child.id},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "サブタスクを親として指定できません"

    def test_create_subtask_with_empty_name_returns_422(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={"name": "   ", "parentId": parent.id},
        )

        assert response.status_code == 422
