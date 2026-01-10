# LangGraph エージェントパターン

## 基本概念

LangGraphは状態管理とノード間のフローを定義するフレームワーク。

## 基本構造

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]  # メッセージ累積
    pdf_content: str
    extracted_items: list
    validated: bool
    error: str | None

def create_agent():
    workflow = StateGraph(AgentState)

    # ノード追加
    workflow.add_node("extract", extract_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("save", save_node)

    # エッジ定義
    workflow.set_entry_point("extract")
    workflow.add_edge("extract", "validate")
    workflow.add_conditional_edges(
        "validate",
        lambda state: "save" if state["validated"] else END,
        {"save": "save", END: END}
    )
    workflow.add_edge("save", END)

    return workflow.compile()
```

## ノード実装

### 抽出ノード

```python
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

def extract_node(state: AgentState) -> dict:
    """PDFからメンテナンス項目を抽出"""
    prompt = f"""
    以下のPDF内容からメンテナンス項目を抽出してJSON形式で出力:
    {state["pdf_content"]}
    """

    response = llm.invoke(prompt)
    items = parse_json(response.content)

    return {
        "extracted_items": items,
        "messages": [f"抽出完了: {len(items)}件"]
    }
```

### 検証ノード

```python
def validate_node(state: AgentState) -> dict:
    """抽出結果を検証"""
    items = state["extracted_items"]

    # バリデーション
    valid = all(
        item.get("item_name") and item.get("frequency")
        for item in items
    )

    return {
        "validated": valid,
        "messages": [f"検証結果: {'OK' if valid else 'NG'}"]
    }
```

### 保存ノード

```python
async def save_node(state: AgentState) -> dict:
    """DBに保存"""
    items = state["extracted_items"]

    for item in items:
        await db.maintenance_schedules.insert(item)

    return {"messages": [f"保存完了: {len(items)}件"]}
```

## 条件分岐

```python
def should_retry(state: AgentState) -> str:
    """リトライ判定"""
    if state.get("error"):
        retry_count = state.get("retry_count", 0)
        if retry_count < 3:
            return "retry"
        return "fail"
    return "continue"

workflow.add_conditional_edges(
    "process",
    should_retry,
    {
        "retry": "process",
        "continue": "next_step",
        "fail": END
    }
)
```

## ツール統合

```python
from langchain_core.tools import tool

@tool
def search_manual(query: str) -> str:
    """マニュアルを検索"""
    # 実装
    return results

@tool
def get_product_info(model_number: str) -> dict:
    """製品情報を取得"""
    # 実装
    return info

# ツール付きエージェント
from langgraph.prebuilt import create_react_agent

tools = [search_manual, get_product_info]
agent = create_react_agent(llm, tools)
```

## 人間介入（Human-in-the-loop）

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

def confirm_node(state: AgentState) -> dict:
    """ユーザー確認を要求"""
    return {
        "messages": ["確認待ち"],
        "awaiting_confirmation": True
    }

workflow = StateGraph(AgentState)
# ... ノード追加 ...

app = workflow.compile(
    checkpointer=checkpointer,
    interrupt_before=["save"]  # save前に中断
)

# 実行
config = {"configurable": {"thread_id": "session-1"}}
result = app.invoke(initial_state, config)

# 中断後、ユーザー確認を得て再開
app.invoke(None, config)  # 続行
```

## マニュアル処理エージェント例

```python
class ManualProcessingState(TypedDict):
    image_data: bytes | None
    pdf_url: str | None
    pdf_content: str | None
    manufacturer: str | None
    model_number: str | None
    maintenance_items: list
    step: str
    error: str | None

def create_manual_agent():
    workflow = StateGraph(ManualProcessingState)

    workflow.add_node("recognize_image", recognize_image_node)
    workflow.add_node("search_pdf", search_pdf_node)
    workflow.add_node("download_pdf", download_pdf_node)
    workflow.add_node("extract_maintenance", extract_maintenance_node)

    workflow.set_entry_point("recognize_image")

    workflow.add_conditional_edges(
        "recognize_image",
        lambda s: "search_pdf" if s["model_number"] else END
    )
    workflow.add_edge("search_pdf", "download_pdf")
    workflow.add_edge("download_pdf", "extract_maintenance")
    workflow.add_edge("extract_maintenance", END)

    return workflow.compile()

# 使用
agent = create_manual_agent()
result = agent.invoke({
    "image_data": image_bytes,
    "step": "start"
})
```

## ストリーミング

```python
async def stream_agent(input_data: dict):
    """エージェントの進捗をストリーミング"""
    async for event in agent.astream_events(input_data, version="v1"):
        if event["event"] == "on_chain_start":
            yield f"開始: {event['name']}\n"
        elif event["event"] == "on_chain_end":
            yield f"完了: {event['name']}\n"
```
