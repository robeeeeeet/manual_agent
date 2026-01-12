# ============================================
# Manual Agent API - Dockerfile for Cloud Run
# ============================================

# --- ステージ1: ビルド ---
FROM python:3.12-slim AS builder

WORKDIR /app

# pikepdf に必要なシステムライブラリをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf \
    libqpdf-dev \
    && rm -rf /var/lib/apt/lists/*

# uv をインストール（高速パッケージマネージャー）
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 依存関係ファイルをコピー（README.md は hatchling ビルドに必要）
COPY pyproject.toml uv.lock README.md ./

# 依存関係をインストール（本番用のみ、--frozen でロックファイル厳守）
RUN uv sync --frozen --no-dev --no-editable

# --- ステージ2: 実行 ---
FROM python:3.12-slim AS runtime

WORKDIR /app

# pikepdf 実行時に必要なライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends \
    qpdf \
    && rm -rf /var/lib/apt/lists/*

# セキュリティ: 非rootユーザーで実行
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# ビルドステージから仮想環境をコピー
COPY --from=builder /app/.venv /app/.venv

# アプリケーションコードをコピー
COPY --chown=appuser:appgroup app ./app

# 仮想環境のパスを設定
ENV PATH="/app/.venv/bin:$PATH"

# Cloud Run は PORT 環境変数を使用
ENV PORT=8080
EXPOSE 8080

# 非rootユーザーに切り替え
USER appuser

# FastAPI 起動（uvicorn）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
