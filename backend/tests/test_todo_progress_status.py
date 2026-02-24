"""
progressStatus API契約のテスト
"""

from app.models.todo import Todo


class TestTodoProgressStatusContract:
    def test_invalid_progress_status_returns_422(self, client, auth_headers):
        response = client.post(
            "/api/todo/",
            headers=auth_headers,
            json={
                "name": "Invalid Status Task",
                "detail": "detail",
                "progressStatus": "waiting",
            },
        )

        assert response.status_code == 422

    def test_list_filter_by_progress_status(
        self, client, auth_headers, test_user, test_db
    ):
        test_db.add_all(
            [
                Todo(
                    name="Not Started",
                    detail="",
                    owner_id=test_user.id,
                    progress_status="not_started",
                ),
                Todo(
                    name="Completed",
                    detail="",
                    owner_id=test_user.id,
                    progress_status="completed",
                ),
            ]
        )
        test_db.commit()

        response = client.get(
            "/api/todo/",
            headers=auth_headers,
            params={"progress_status": "completed"},
        )

        assert response.status_code == 200
        data = response.json()
        assert [item["name"] for item in data] == ["Completed"]
