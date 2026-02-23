class AppError(Exception):
    """アプリケーション固有の例外の基底クラス"""

    pass


class NotFoundError(AppError):
    """リソースが見つからない場合のエラー"""

    pass


class DuplicateError(AppError):
    """リソースが重複している場合のエラー"""

    def __init__(
        self, message: str = "Resource already exists", field: str = "unknown"
    ):
        super().__init__(message)
        self.field = field


class RequiredFieldError(AppError):
    """必須フィールドが不足している場合のエラー"""

    def __init__(self, message: str = "Field is required", field: str = "unknown"):
        super().__init__(message)
        self.field = field


class AuthenticationError(AppError):
    """認証に失敗した場合のエラー"""

    pass


class InvalidParentTodoError(AppError):
    """サブタスク作成時の親タスク指定が不正な場合のエラー"""

    pass


class ParentTodoCompletionBlockedError(AppError):
    """未完了サブタスクが存在して親タスクを完了できない場合のエラー"""

    pass


class SubtaskRecurrenceNotAllowedError(AppError):
    """サブタスクに繰り返し設定を指定した場合のエラー"""

    pass
