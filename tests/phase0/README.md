# Phase 0: フィジビリティ確認

家電メンテナンスリマインドアプリのコアAI機能の実現可能性を検証。

## 判定結果: Go

3つのコアAI機能すべてが100%の成功率を達成。

| Phase | 検証内容 | 成功率 |
|-------|----------|--------|
| 0-1 | 画像からメーカー・型番読み取り | 100% |
| 0-2 | メーカー・型番からマニュアルPDF取得 | 100% |
| 0-3 | マニュアルからメンテナンス項目抽出 | 100% |

## フォルダ構成

```
tests/phase0/
├── README.md           # 本ファイル
├── reports/            # 検証レポート
│   ├── REPORT_PHASE0-1.md
│   ├── REPORT_PHASE0-2.md
│   ├── REPORT_PHASE0-3.md
│   └── REPORT_PHASE0_SUMMARY.md
├── scripts/            # 最終版スクリプト
│   ├── test_image_recognition.py      # Phase 0-1
│   ├── test_custom_search_api.py      # Phase 0-2 (推奨)
│   ├── test_maintenance_extraction.py # Phase 0-3
│   └── download_test_pdfs.py          # PDF取得ユーティリティ
├── archive/            # 過去バージョン (gitignore)
├── test_images/        # テスト画像 (gitignore)
├── test_pdfs/          # テストPDF (gitignore)
└── results/            # 抽出結果 (gitignore)
```

## 実行方法

```bash
# Phase 0-1: 画像認識
uv run python scripts/test_image_recognition.py

# Phase 0-2: PDF取得
uv run python scripts/test_custom_search_api.py

# Phase 0-3: メンテナンス抽出
uv run python scripts/test_maintenance_extraction.py
```

## 環境変数

`.env` ファイルに以下を設定:

```bash
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CSE_ID=your_search_engine_id
GOOGLE_CSE_API_KEY=your_cse_api_key
```

## 詳細

総合レポート: [reports/REPORT_PHASE0_SUMMARY.md](reports/REPORT_PHASE0_SUMMARY.md)
