from app.models.todo import Todo


class TestTodoSubtaskProgress:
    def test_cannot_complete_parent_with_incomplete_subtasks(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.flush()
        subtask = Todo(
            name="未完了サブタスク",
            detail="",
            owner_id=test_user.id,
            parent_id=parent.id,
            progress_status="not_started",
        )
        test_db.add(subtask)
        test_db.commit()

        response = client.put(
            f"/api/todo/{parent.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "未完了のサブタスクがあるため完了できません"

    def test_can_complete_parent_when_all_subtasks_completed(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.flush()
        completed_subtask = Todo(
            name="完了サブタスク",
            detail="",
            owner_id=test_user.id,
            parent_id=parent.id,
            progress_status="completed",
        )
        test_db.add(completed_subtask)
        test_db.commit()

        response = client.put(
            f"/api/todo/{parent.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        assert response.json()["progressStatus"] == "completed"

    def test_parent_progress_is_zero_when_no_subtasks(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()

        response = client.get(f"/api/todo/{parent.id}/", headers=auth_headers)

        assert response.status_code == 200
        assert response.json()["completedSubtaskCount"] == 0
        assert response.json()["totalSubtaskCount"] == 0
        assert response.json()["subtaskProgressPercent"] == 0
