from app.models.todo import Todo


class TestTodoSubtaskDelete:
    def test_delete_parent_todo_also_deletes_subtasks(
        self, client, auth_headers, test_user, test_db
    ) -> None:
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        subtask = Todo(
            name="子タスク",
            detail="",
            owner_id=test_user.id,
            parent_id=parent.id,
        )
        test_db.add(subtask)
        test_db.commit()
        test_db.refresh(subtask)

        delete_response = client.delete(
            f"/api/todo/{parent.id}/",
            headers=auth_headers,
        )

        assert delete_response.status_code == 204

        parent_response = client.get(
            f"/api/todo/{parent.id}/",
            headers=auth_headers,
        )
        assert parent_response.status_code == 404

        subtask_response = client.get(
            f"/api/todo/{subtask.id}/",
            headers=auth_headers,
        )
        assert subtask_response.status_code == 404
