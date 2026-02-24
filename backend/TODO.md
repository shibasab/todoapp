# Backend TODO

このプロジェクトで今後実施予定のタスク一覧。
完了したものは `[DONE]`のラベルを付ける。

## アーキテクチャ改善

### [DONE] HTTPException のレイヤー分離

**現状**: Services層 (`services/todo.py`, `services/auth.py`) でFastAPI固有の `HTTPException` を直接投げている。

**問題**: Services層がHTTP層に依存しており、純粋なレイヤー分離になっていない。

**対応方針**:
1. `app/exceptions.py` にカスタムビジネス例外を作成
   - `AppError(Exception)` - 基底クラス
   - `NotFoundError(AppError)` - リソースが見つからない
   - `DuplicateError(AppError)` - 重複エラー
   - `AuthenticationError(AppError)` - 認証エラー
2. Services層でカスタム例外を投げる
3. Routers層で例外をキャッチして `HTTPException` に変換

**対象ファイル**:
- `app/services/todo.py`
- `app/services/auth.py`
- `app/routers/todo.py`
- `app/routers/auth.py`
