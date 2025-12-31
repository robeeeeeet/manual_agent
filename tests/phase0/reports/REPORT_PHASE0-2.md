# Phase 0-2: マニュアルPDF自動取得 検証レポート

## 概要

メーカー名・型番からWeb検索で公式取扱説明書PDFを自動取得する機能の実現可能性を検証。

## 検証結果

| 指標 | 結果 |
|------|------|
| **成功率** | **100%** (4/4) |
| **正確率** | **100%** (4/4) |
| **推奨実装** | LLMベースPDF抽出 + 再帰的階層探索 |

### テスト製品と結果

| メーカー | 型番 | カテゴリ | 結果 | 取得PDF |
|----------|------|----------|------|---------|
| 日立 | MRO-S7D | オーブンレンジ | ✅ 成功 | `mro-s7d_M.pdf` |
| 象印 | CP-EA20 | 電気ポット | ✅ 成功 | `CPEA.pdf` |
| 象印 | NW-JX10 | 炊飯器 | ✅ 成功 | `NWJX.pdf` |
| タイガー | KAM-R132 | オーブントースター | ✅ 成功 | `KAM-R132/file` |

---

## 技術的アプローチ

### 初期アプローチと問題点

#### アプローチ1: Geminiにプロンプトで指示
- **問題**: GeminiがURLを「生成」してしまい、存在しないURLを回答する
- **成功率**: 25%

#### アプローチ2: プロンプト改善・モデル比較
- **問題**: gemini-2.0-flash, gemini-2.5-flash でも改善せず
- **成功率**: 50%

### 最終アプローチ: Claude Code WebSearch模倣

Claude Code WebSearchの仕組みを分析し、以下の戦略を実装：

```
1. Grounded Searchで検索 → Grounding Chunksからリダイレクト先の実URLを取得
2. 公式ドメインでフィルタリング
3. 型番を含むURLを優先ソート
4. サイト固有のPDF抽出ロジックで取得
```

#### 重要な発見: Grounding Chunks

Gemini Grounded Searchの`grounding_chunks`にはGoogle経由のリダイレクトURLが含まれる：
```
vertexaisearch.cloud.google.com/grounding-api-redirect/...
```

このURLに`requests.head(allow_redirects=True)`でアクセスすると、実際のURLが取得できる。

```python
def get_actual_url(redirect_url):
    response = requests.head(redirect_url, allow_redirects=True, timeout=10)
    return response.url  # 実際のURL
```

### サイト固有の対応

| メーカー | サイト構造 | 対応策 |
|----------|-----------|--------|
| 日立 | `/support/range/item/{型番}/manual.html` | 標準抽出 |
| 象印 | `/toiawase/manual/{カテゴリ}/` → 詳細ページ → PDF | 2段階ナビゲーション |
| タイガー | `/ja/manuals/{カテゴリ}/{型番}/file` | `/file`サフィックス対応 |

---

## 最終実装コード

ファイル: `tests/phase0/archive/test_search_then_analyze_v3.py`

主要コンポーネント:
1. `get_search_results_via_grounding()` - 検索結果取得（リダイレクトフォロー）
2. `is_official_domain()` - 公式ドメイン判定
3. `prioritize_urls()` - 型番含むURL優先ソート
4. `extract_pdf_from_page()` - サイト固有PDF抽出
5. `verify_pdf()` - PDF検証（タイガー/file対応含む）

---

## 課題と対策

### 課題1: LLMがURLを生成してしまう
**対策**: LLMにはURL選択のみさせず、Grounding Chunksから直接URL取得

### 課題2: サイトごとに構造が異なる
**対策**: 主要メーカーごとにPDF抽出ロジックを実装
- 新規メーカー対応時は同様のロジック追加が必要

### 課題3: 検索結果の精度
**対策**:
- 公式ドメインリストでフィルタリング
- 型番を含むURLを優先

---

## 推奨事項

### 本実装時の考慮点

1. **公式ドメインリストの管理**
   - メーカーごとの公式ドメインをDBで管理
   - 新規メーカー追加時に更新

2. **サイト固有ロジックのモジュール化**
   - メーカーごとのPDF抽出クラスを実装
   - Strategy patternで切り替え

3. **フォールバック機能**
   - 自動取得失敗時は手動アップロードを促す
   - 取得成功率のモニタリング

4. **キャッシュ機能**
   - 同一型番の再検索を避ける
   - PDF URLを一定期間キャッシュ

---

## 結論

**Go判定: ✅ 実装可能**

- 成功率100%を達成
- Claude Code WebSearch模倣アプローチが有効
- サイト固有ロジックは必要だが、主要メーカー対応で実用レベル
- 手動アップロードのフォールバックと併用で運用可能

---

---

## 推奨実装: LLMベースPDF抽出

### 概要

サイト固有のハードコードを排除し、LLMがページを解析してPDFリンクを抽出するアプローチ。

ファイル: `tests/phase0/archive/test_llm_pdf_extraction.py`

### 処理フロー

```
1. Grounded Searchで公式サイトURLを取得
2. ページHTMLを取得し、リンクを優先度別に分類
   - 型番関連リンク（最優先）
   - PDFリンク
   - マニュアル関連リンク
   - その他
3. LLMがリンク一覧を解析してPDF URLまたは探索リンクを返す
4. PDFが見つかるまで再帰的に探索（最大深度3）
```

### 探索結果

| メーカー | 型番 | 探索深度 | PDF取得 |
|----------|------|----------|---------|
| 日立 | MRO-S7D | 深度0 | 直接リンク |
| 象印 | CP-EA20 | 深度1 | 一覧→詳細→PDF |
| 象印 | NW-JX10 | 深度1 | 検索→詳細→PDF |
| タイガー | KAM-R132 | 深度0 | 直接リンク |

### メリット

1. **サイト固有コード不要**: 新規メーカー対応時のコード修正が不要
2. **階層構造対応**: 複数ページをたどる構造にも自動対応
3. **柔軟性**: LLMが文脈を理解してリンクを選択

### デメリット

1. **API呼び出し増加**: 深い階層ではLLM呼び出しが増える
2. **レイテンシ**: 再帰探索で時間がかかる場合あり
3. **コスト**: LLM利用料金が増加

### 主要コンポーネント

```python
# リンク抽出（優先度付き）
def fetch_page_html(url: str, model_number: str) -> str:
    # 型番含むリンク → PDF → マニュアル関連 → その他

# LLMによる解析
def extract_pdf_with_llm(page_info: str, ...) -> dict:
    # {found_pdf, explore_links, reason}

# 再帰的探索
def search_pdf_recursive(url, ..., depth, visited) -> dict:
    # 最大深度まで探索
```

---

## 比較: 2つのアプローチ

| 項目 | ハードコード版 | LLMベース版 |
|------|---------------|-------------|
| 成功率 | 100% | 100% |
| サイト固有コード | 必要 | 不要 |
| 新規サイト対応 | コード追加 | 自動対応 |
| API呼び出し | 少ない | 多い |
| 保守性 | 低い | 高い |

**推奨**: LLMベース版を採用（保守性・拡張性を重視）

---

## 参考: 検証スクリプト一覧

| ファイル | 説明 | 成功率 |
|----------|------|--------|
| `archive/test_grounded_search.py` | 初版 | 25% |
| `archive/test_grounded_search_v2.py` | ハイブリッド | 25% |
| `archive/test_grounded_search_v3.py` | 直接PDF対応 | 50% |
| `archive/test_grounded_search_v4.py` | プロンプト改善 | 50% |
| `archive/test_grounded_search_final.py` | リダイレクトフォロー | 75% |
| `archive/test_search_then_analyze_v3.py` | ハードコード版 | 100% |
| `archive/test_llm_pdf_extraction.py` | LLMベース版 | 100% |
| `scripts/test_custom_search_api.py` | **Custom Search API版（推奨）** | **100%** |

---

## 最終推奨: Custom Search API アプローチ

### 概要

Google Custom Search JSON APIを使用したPDF取得。`filetype:pdf`オペレーターにより直接PDF検索が可能。

ファイル: `tests/phase0/scripts/test_custom_search_api.py`

### 処理フロー

```
Step 1: 直接PDF検索
  クエリ: "{メーカー} {型番} 取扱説明書 filetype:pdf site:{公式ドメイン}"
  → 検索結果のスニペットで判断
  → 必要に応じてPDFダウンロード＋LLM検証

Step 2: マニュアルページ検索（PDFが直接見つからない場合）
  クエリ: "{メーカー} {型番} 取扱説明書 site:{公式ドメイン}"
  → ページ内リンクをLLMで解析
  → 再帰的に探索（最大深度3）
```

### 検証結果

| メーカー | 型番 | 取得方法 | 備考 |
|----------|------|----------|------|
| 日立 | MRO-S7D | Step 1: 直接PDF | `filetype:pdf`で即発見 |
| 象印 | CP-EA20 | Step 2: ページ検索 | 直接PDFヒットなし |
| 象印 | NW-JX10 | Step 2: ページ検索 | 別型番のPDFがヒット |
| タイガー | KAM-R132 | Step 2: ページ検索 | tiger-forest.comで発見 |

### Grounded Search vs Custom Search API

| 項目 | Grounded Search | Custom Search API |
|------|-----------------|-------------------|
| 成功率 | 100% | 100% |
| `filetype:pdf` | ❌ 使用不可 | ✅ 使用可能 |
| スニペット取得 | ❌ | ✅ |
| 無料枠 | Gemini API内 | 100クエリ/日 |
| 超過料金 | なし | $5/1000クエリ |
| LLM呼び出し | 約3回/製品 | 約1-2回/製品 |

### コスト見積もり（1製品あたり）

| 項目 | 費用 |
|------|------|
| Custom Search API | 無料（100クエリ/日以内） |
| LLM呼び出し（Step 2時） | 約$0.002 |
| **合計** | **約$0.002/製品（約0.3円）** |

※ 1日100製品を超える場合は追加料金発生

### 採用理由

1. **直接PDF検索可能**: `filetype:pdf`でPDFを直接発見できるケースあり
2. **LLM呼び出し削減**: スニペット判断で不要なLLM呼び出しを回避
3. **予測可能なコスト**: Custom Search APIの料金体系が明確
4. **スケーラビリティ**: サイト固有コード不要で新規メーカーにも対応

### 環境変数

```bash
# .env
GOOGLE_CSE_ID=your_search_engine_id
GOOGLE_CSE_API_KEY=your_api_key
```

### CSE作成時の設定

1. https://programmablesearchengine.google.com/ でCSE作成
2. 「ウェブ全体を検索」を選択
3. 検索対象サイトは設定不要（クエリで`site:`指定）
