# メンテナンス抽出スキーマ

## 出力スキーマ

### Pydantic モデル

```python
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class MaintenanceItem(BaseModel):
    """メンテナンス項目"""
    item_name: str = Field(description="項目名（例: フィルター清掃）")
    description: str = Field(description="詳細説明")
    frequency: str = Field(description="周期（例: 月1回、年1回、適宜）")
    frequency_days: Optional[int] = Field(
        default=None,
        description="周期を日数で表現（月1回=30、年1回=365）"
    )
    category: Literal["cleaning", "inspection", "replacement", "safety"]
    importance: Literal["high", "medium", "low"]
    page_reference: Optional[str] = Field(
        default=None,
        description="記載ページ"
    )

class ProductInfo(BaseModel):
    """製品情報"""
    manufacturer: str
    model_number: str
    category: str

class ExtractionResult(BaseModel):
    """抽出結果"""
    product: ProductInfo
    maintenance_items: List[MaintenanceItem]
    notes: Optional[str] = Field(
        default=None,
        description="抽出時の補足事項"
    )
```

## 周期マッピングルール

| 説明書の表現 | frequency | frequency_days | category |
|-------------|-----------|----------------|----------|
| 毎日 | 毎日 | 1 | cleaning |
| 使用後毎回 | 使用後毎回 | 1 | cleaning |
| 週1回 | 週1回 | 7 | cleaning |
| 2週間ごと | 2週間ごと | 14 | cleaning |
| 月1回 | 月1回 | 30 | cleaning/inspection |
| 3ヶ月ごと | 3ヶ月ごと | 90 | inspection |
| 半年ごと | 半年ごと | 180 | inspection |
| 年1回 | 年1回 | 365 | inspection/replacement |
| シーズン前 | シーズン前 | None | inspection |
| 適宜 | 適宜 | None | varies |
| 異常時 | 異常時 | None | safety |

## カテゴリ定義

| category | 説明 | 例 |
|----------|------|-----|
| cleaning | 清掃・お手入れ | フィルター清掃、庫内清掃 |
| inspection | 点検・確認 | 動作確認、異音チェック |
| replacement | 交換 | フィルター交換、パッキン交換 |
| safety | 安全確認 | 電源コード確認、漏電チェック |

## 重要度判定

| importance | 条件 |
|------------|------|
| high | 安全に関わる、故障の原因となる |
| medium | 性能維持に重要、メーカー推奨 |
| low | あると望ましい、美観維持 |

## 抽出プロンプト

```
この取扱説明書から定期的なメンテナンス項目を抽出してください。

## 製品情報
- メーカー: {manufacturer}
- 型番: {model_number}
- カテゴリ: {category}

## 抽出対象
1. 定期的なお手入れ・清掃項目
2. 定期点検・交換項目
3. 安全確認項目

## 出力形式（JSON）
{schema_json}

## 注意
- 説明書に明記されている項目のみ抽出
- 推測や一般的なアドバイスは含めない
- 周期が不明な場合は「適宜」と記載
```

## DB保存時の変換

```python
def to_db_record(item: MaintenanceItem, appliance_id: str) -> dict:
    """DBレコードに変換"""
    return {
        "appliance_id": appliance_id,
        "task_name": item.item_name,
        "interval_type": "days" if item.frequency_days else "manual",
        "interval_value": item.frequency_days,
        "source_page": item.page_reference,
        "next_due_at": calculate_next_due(item.frequency_days)
    }
```
