from datetime import date

from app.models.todo import Todo


class TestTodoSubtaskRecurrenceRules:
    def test_create_subtask_with_recurrence_returns_409(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "繰り返しサブタスク",
                "parentId": parent.id,
                "dueDate": "2026-03-01",
                "recurrenceType": "daily",
            },
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "サブタスクには繰り返し設定できません"

    def test_update_subtask_to_recurring_returns_409(
        self, client, auth_headers, test_user, test_db
    ):
        parent = Todo(name="親タスク", detail="", owner_id=test_user.id)
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        subtask = Todo(
            name="サブタスク",
            detail="",
            owner_id=test_user.id,
            parent_id=parent.id,
            recurrence_type="none",
        )
        test_db.add(subtask)
        test_db.commit()
        test_db.refresh(subtask)

        response = client.put(
            f"/api/todo/{subtask.id}/",
            headers=auth_headers,
            json={"dueDate": "2026-03-02", "recurrenceType": "weekly"},
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "サブタスクには繰り返し設定できません"

    def test_recurrence_successor_does_not_copy_subtasks(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        class FixedDate(date):
            @classmethod
            def today(cls):
                return cls(2026, 2, 1)

        monkeypatch.setattr("app.services.todo.date", FixedDate)

        parent = Todo(
            name="週次親タスク",
            detail="",
            owner_id=test_user.id,
            due_date=date(2026, 1, 31),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(parent)
        test_db.commit()
        test_db.refresh(parent)

        subtask = Todo(
            name="完了済みサブタスク",
            detail="",
            owner_id=test_user.id,
            parent_id=parent.id,
            progress_status="completed",
        )
        test_db.add(subtask)
        test_db.commit()

        response = client.put(
            f"/api/todo/{parent.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        successor = (
            test_db.query(Todo).filter(Todo.previous_todo_id == parent.id).first()
        )
        assert successor is not None
        assert successor.parent_id is None

        copied_subtasks = (
            test_db.query(Todo)
            .filter(Todo.parent_id == successor.id, Todo.owner_id == test_user.id)
            .all()
        )
        assert copied_subtasks == []
