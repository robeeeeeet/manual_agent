#!/usr/bin/env python3
"""
メンテナンス項目のdescriptionをHTML形式に変換するスクリプト

既存の shared_maintenance_items.description をプレーンテキストから
HTML形式に変換します。Gemini APIを使用して自然言語処理で変換します。

使用方法:
    cd backend && uv run python ../scripts/migrate_maintenance_description.py [options]

オプション:
    --dry-run   実際の変更を行わずに、変換結果をプレビュー
    --limit N   処理する件数を制限（デフォルト: 全件）
    --delay N   API呼び出し間の待機時間（秒）（デフォルト: 1）

注意:
    - .env ファイルに SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY が設定されている必要があります
    - 変換前にDBバックアップを取ることを強く推奨します
    - API呼び出し回数に注意してください（コスト発生）
"""

import argparse
import asyncio
import logging
import os
import re
import sys
import time
from pathlib import Path

# プロジェクトルートを追加
project_root = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from supabase import create_client, Client

# .env 読み込み
load_dotenv(Path(__file__).parent.parent / ".env")

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Supabaseクライアントを取得"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")

    return create_client(url, key)


def get_gemini_client():
    """Geminiクライアントを取得"""
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY must be set")

    return genai.Client(api_key=api_key)


def is_already_html(description: str) -> bool:
    """既にHTML形式かどうか判定"""
    if not description:
        return True

    # HTMLタグが含まれているかチェック
    html_pattern = r"<(p|ol|ul|li|strong|em|h[1-6]|br)\s*/?\s*>"
    return bool(re.search(html_pattern, description, re.IGNORECASE))


def convert_to_html(gemini_client, description: str, task_name: str) -> str:
    """プレーンテキストをHTML形式に変換"""
    if not description or is_already_html(description):
        return description

    prompt = f"""以下のメンテナンス作業の説明文をHTML形式に変換してください。

## 作業名
{task_name}

## 元の説明文
{description}

## 出力形式
- 概要は `<p>` タグで囲む
- 手順がある場合は `<ol><li>` タグで番号付きリストにする
- 箇条書きの場合は `<ul><li>` タグを使用
- 強調部分は `<strong>` タグを使用
- 改行が必要な場合は `<br>` タグを使用

## 出力ルール
- HTMLタグのみを出力（説明やコードブロックは不要）
- 内容を追加・削除せず、元の説明文の意味を保持
- シンプルなHTMLを維持（不要なタグやクラスは付けない）

HTMLを出力してください:"""

    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash", contents=prompt
    )

    result = response.text.strip()

    # コードブロックで囲まれている場合は除去
    if result.startswith("```html"):
        result = result[7:]
    if result.startswith("```"):
        result = result[3:]
    if result.endswith("```"):
        result = result[:-3]

    return result.strip()


def get_maintenance_items(supabase: Client, limit: int | None = None) -> list[dict]:
    """変換対象のメンテナンス項目を取得"""
    query = supabase.table("shared_maintenance_items").select("id, task_name, description")

    if limit:
        query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_description(supabase: Client, item_id: str, new_description: str) -> bool:
    """descriptionを更新"""
    try:
        supabase.table("shared_maintenance_items").update({
            "description": new_description
        }).eq("id", item_id).execute()
        return True
    except Exception as e:
        logger.error(f"Update failed for {item_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="メンテナンス項目のdescriptionをHTML形式に変換"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の変更を行わずに、変換結果をプレビュー",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="処理する件数を制限",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="API呼び出し間の待機時間（秒）",
    )
    args = parser.parse_args()

    print("=" * 80)
    print("メンテナンス説明文 HTML形式変換")
    print("=" * 80)

    if args.dry_run:
        print()
        print("  *** DRY-RUN モード: 実際の変更は行いません ***")

    print()

    # クライアント初期化
    try:
        supabase = get_supabase_client()
        logger.info("Supabase接続成功")
    except Exception as e:
        logger.error(f"Supabase接続失敗: {e}")
        sys.exit(1)

    try:
        gemini = get_gemini_client()
        logger.info("Gemini接続成功")
    except Exception as e:
        logger.error(f"Gemini接続失敗: {e}")
        sys.exit(1)

    # 対象項目を取得
    items = get_maintenance_items(supabase, args.limit)
    logger.info(f"対象メンテナンス項目数: {len(items)}")

    if not items:
        logger.info("変換対象がありません")
        return

    # 変換実行
    success_count = 0
    skip_count = 0
    error_count = 0

    for i, item in enumerate(items, 1):
        item_id = item["id"]
        task_name = item["task_name"]
        description = item.get("description") or ""

        print()
        print(f"[{i}/{len(items)}] {task_name}")
        print(f"  ID: {item_id}")

        if is_already_html(description):
            print("  [SKIP] 既にHTML形式です")
            skip_count += 1
            continue

        print(f"  [ORIGINAL] {description[:100]}..." if len(description) > 100 else f"  [ORIGINAL] {description}")

        try:
            new_description = convert_to_html(gemini, description, task_name)
            print(f"  [CONVERTED] {new_description[:100]}..." if len(new_description) > 100 else f"  [CONVERTED] {new_description}")

            if args.dry_run:
                print("  [DRY-RUN] DBには書き込みません")
                success_count += 1
            else:
                if update_description(supabase, item_id, new_description):
                    print("  [OK] DB更新成功")
                    success_count += 1
                else:
                    print("  [ERROR] DB更新失敗")
                    error_count += 1

            # API呼び出し間隔を空ける
            if i < len(items):
                time.sleep(args.delay)

        except Exception as e:
            print(f"  [ERROR] 変換失敗: {e}")
            error_count += 1

    print()
    print("=" * 80)
    print("結果サマリー")
    print("=" * 80)
    print(f"  合計: {len(items)}")
    print(f"  変換成功: {success_count}")
    print(f"  スキップ（既にHTML形式）: {skip_count}")
    print(f"  エラー: {error_count}")
    print("=" * 80)

    if args.dry_run:
        print()
        print("これはDRY-RUNです。実際に変換するには --dry-run を外して実行してください。")


if __name__ == "__main__":
    main()
