# LangChain PDF処理パターン

## 概要

LangChainを使用したPDF処理とRAG統合のパターン。

## 基本セットアップ

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.environ["GEMINI_API_KEY"]
)
```

## PDF読み込み

### PyPDFLoader

```python
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("manual.pdf")
pages = loader.load()

for page in pages:
    print(f"Page {page.metadata['page']}: {page.page_content[:100]}...")
```

### UnstructuredPDFLoader（複雑なレイアウト）

```python
from langchain_community.document_loaders import UnstructuredPDFLoader

loader = UnstructuredPDFLoader("manual.pdf", mode="elements")
elements = loader.load()
```

## メンテナンス抽出チェーン

```python
from pydantic import BaseModel
from typing import List, Literal

class MaintenanceItem(BaseModel):
    item_name: str
    frequency: str
    category: Literal["cleaning", "inspection", "replacement", "safety"]

class ExtractionResult(BaseModel):
    items: List[MaintenanceItem]

prompt = ChatPromptTemplate.from_messages([
    ("system", "PDFからメンテナンス項目を抽出するアシスタント"),
    ("human", "{pdf_content}")
])

chain = prompt | llm.with_structured_output(ExtractionResult)

result = chain.invoke({"pdf_content": pdf_text})
```

## RAG統合

### ベクトルストア

```python
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from supabase import create_client

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=os.environ["GEMINI_API_KEY"]
)

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_ANON_KEY"]
)

vectorstore = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)
```

### 検索チェーン

```python
from langchain.chains import RetrievalQA

retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever
)

answer = qa_chain.invoke({"query": "フィルター清掃の頻度は？"})
```

## LangGraph エージェント

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class AgentState(TypedDict):
    pdf_content: str
    extracted_items: list
    validated: bool

def extract_items(state: AgentState) -> AgentState:
    # メンテナンス項目抽出
    items = extraction_chain.invoke({"content": state["pdf_content"]})
    return {"extracted_items": items}

def validate_items(state: AgentState) -> AgentState:
    # 抽出結果の検証
    valid = all(item.frequency for item in state["extracted_items"])
    return {"validated": valid}

workflow = StateGraph(AgentState)
workflow.add_node("extract", extract_items)
workflow.add_node("validate", validate_items)
workflow.add_edge("extract", "validate")
workflow.add_edge("validate", END)

app = workflow.compile()
result = app.invoke({"pdf_content": pdf_text})
```

## テキスト分割

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", "。", "、", " "]
)

chunks = splitter.split_documents(pages)
```
