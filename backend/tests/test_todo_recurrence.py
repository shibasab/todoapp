from datetime import date

from app.models.todo import Todo
from app.models.user import User
from app.services.auth import create_access_token


class FixedDate(date):
    @classmethod
    def today(cls):
        return cls(2026, 1, 31)


class LeapYearFixedDate(date):
    @classmethod
    def today(cls):
        return cls(2024, 1, 31)


class TestTodoRecurrenceValidation:
    def test_create_recurring_todo_requires_due_date(self, client, auth_headers):
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Daily Task",
                "detail": "detail",
                "recurrenceType": "daily",
            },
        )

        assert response.status_code == 422
        data = response.json()
        assert data["type"] == "validation_error"
        assert data["errors"] == [{"field": "dueDate", "reason": "required"}]

    def test_create_recurring_todo_with_due_date(self, client, auth_headers):
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Weekly Task",
                "detail": "detail",
                "dueDate": "2026-02-15",
                "recurrenceType": "weekly",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["recurrenceType"] == "weekly"
        assert data["dueDate"] == "2026-02-15"


class TestTodoRecurrenceGeneration:
    def test_daily_recurrence_generates_next_due_date_from_completion_date(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Daily Backup",
            detail="Run incremental backup",
            owner_id=test_user.id,
            due_date=date(2026, 1, 28),
            recurrence_type="daily",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        successor = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).first()
        )
        assert successor is not None
        assert successor.name == "Daily Backup"
        assert successor.detail == "Run incremental backup"
        assert successor.recurrence_type == "daily"
        assert successor.progress_status == "not_started"
        assert successor.due_date == date(2026, 2, 1)

    def test_complete_recurring_todo_generates_next_todo(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Weekly Report",
            detail="Prepare status report",
            owner_id=test_user.id,
            due_date=date(2026, 1, 20),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        completed = test_db.query(Todo).filter(Todo.id == original.id).first()
        assert completed is not None
        assert completed.progress_status == "completed"

        successors = (
            test_db.query(Todo)
            .filter(Todo.previous_todo_id == original.id, Todo.owner_id == test_user.id)
            .all()
        )
        assert len(successors) == 1
        successor = successors[0]
        assert successor.name == "Weekly Report"
        assert successor.detail == "Prepare status report"
        assert successor.recurrence_type == "weekly"
        assert successor.progress_status == "not_started"
        assert successor.due_date == date(2026, 2, 7)

    def test_duplicate_completion_requests_do_not_generate_multiple_successors(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Daily Standup",
            detail="",
            owner_id=test_user.id,
            due_date=date(2026, 1, 31),
            recurrence_type="daily",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        first = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )
        second = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert first.status_code == 200
        assert second.status_code == 200

        successors = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).all()
        )
        assert len(successors) == 1

    def test_monthly_recurrence_adjusts_to_end_of_month(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Monthly Billing",
            detail="",
            owner_id=test_user.id,
            due_date=date(2026, 1, 31),
            recurrence_type="monthly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        successor = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).first()
        )
        assert successor is not None
        assert successor.due_date == date(2026, 2, 28)

    def test_monthly_recurrence_adjusts_to_leap_day_when_available(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", LeapYearFixedDate)
        original = Todo(
            name="Monthly Billing (Leap)",
            detail="",
            owner_id=test_user.id,
            due_date=date(2024, 1, 31),
            recurrence_type="monthly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 200
        successor = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).first()
        )
        assert successor is not None
        assert successor.due_date == date(2024, 2, 29)

    def test_disable_recurrence_prevents_successor_generation(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Temporary Recurrence",
            detail="",
            owner_id=test_user.id,
            due_date=date(2026, 1, 25),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        disable_response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"recurrenceType": "none"},
        )
        complete_response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert disable_response.status_code == 200
        assert complete_response.status_code == 200
        successors = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).all()
        )
        assert len(successors) == 0

    def test_recurrence_type_change_applies_to_next_generation(
        self, client, auth_headers, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Recurring Cleanup",
            detail="Cleanup old logs",
            owner_id=test_user.id,
            due_date=date(2026, 1, 14),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        change_response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"recurrenceType": "monthly"},
        )
        complete_response = client.put(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
            json={"progressStatus": "completed"},
        )

        assert change_response.status_code == 200
        assert complete_response.status_code == 200

        successor = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).first()
        )
        assert successor is not None
        assert successor.recurrence_type == "monthly"
        assert successor.due_date == date(2026, 2, 28)

    def test_other_user_cannot_complete_recurring_todo(
        self, client, test_user, test_db, monkeypatch
    ):
        monkeypatch.setattr("app.services.todo.date", FixedDate)
        original = Todo(
            name="Private Recurrence",
            detail="Owner only",
            owner_id=test_user.id,
            due_date=date(2026, 1, 20),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(original)

        other_user = User(username="otheruser-recurrence", email="other@example.com")
        other_user.set_password("otherpassword")
        test_db.add(other_user)
        test_db.commit()
        test_db.refresh(original)
        test_db.refresh(other_user)

        token = create_access_token(data={"sub": str(other_user.id)})
        other_headers = {"Authorization": f"Bearer {token}"}

        response = client.put(
            f"/api/todo/{original.id}/",
            headers=other_headers,
            json={"progressStatus": "completed"},
        )

        assert response.status_code == 404
        successors = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).all()
        )
        assert len(successors) == 0

    def test_delete_recurring_todo_prevents_future_successor_generation(
        self, client, auth_headers, test_user, test_db
    ):
        original = Todo(
            name="Deletable Recurrence",
            detail="",
            owner_id=test_user.id,
            due_date=date(2026, 1, 20),
            recurrence_type="weekly",
            progress_status="not_started",
        )
        test_db.add(original)
        test_db.commit()
        test_db.refresh(original)

        delete_response = client.delete(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
        )
        get_response = client.get(
            f"/api/todo/{original.id}/",
            headers=auth_headers,
        )

        assert delete_response.status_code == 204
        assert get_response.status_code == 404

        successors = (
            test_db.query(Todo).filter(Todo.previous_todo_id == original.id).all()
        )
        assert len(successors) == 0
