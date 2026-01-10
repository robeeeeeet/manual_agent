# LangChain 統合

## セットアップ

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.1,
)
```

## チェーン構築

### 基本チェーン

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "家電メンテナンスの専門家として回答してください。"),
    ("human", "{question}")
])

chain = prompt | llm | StrOutputParser()

result = chain.invoke({"question": "エアコンのフィルター清掃頻度は？"})
```

### 構造化出力

```python
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel
from typing import List

class MaintenanceItems(BaseModel):
    items: List[MaintenanceItem]

parser = JsonOutputParser(pydantic_object=MaintenanceItems)

prompt = ChatPromptTemplate.from_messages([
    ("system", "PDFからメンテナンス項目を抽出。{format_instructions}"),
    ("human", "{pdf_content}")
])

chain = prompt | llm | parser

result = chain.invoke({
    "pdf_content": pdf_text,
    "format_instructions": parser.get_format_instructions()
})
```

### with_structured_output

```python
# Pydanticモデルで直接出力
chain = prompt | llm.with_structured_output(MaintenanceItems)

result: MaintenanceItems = chain.invoke({"pdf_content": pdf_text})
```

## RAG実装

### ベクトルストア

```python
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=settings.GEMINI_API_KEY
)

vectorstore = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)
```

### 検索チェーン

```python
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

system_prompt = """マニュアルを参照して質問に回答してください。

Context:
{context}
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}")
])

question_answer_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, question_answer_chain)

result = rag_chain.invoke({"input": "フィルター清掃の手順は？"})
print(result["answer"])
```

## プロンプトテンプレート

### Few-shot

```python
from langchain_core.prompts import FewShotPromptTemplate, PromptTemplate

examples = [
    {"input": "月1回清掃", "output": '{"frequency": "月1回", "frequency_days": 30}'},
    {"input": "週に1度点検", "output": '{"frequency": "週1回", "frequency_days": 7}'},
]

example_prompt = PromptTemplate(
    input_variables=["input", "output"],
    template="入力: {input}\n出力: {output}"
)

few_shot_prompt = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    prefix="周期表現をJSON形式に変換:",
    suffix="入力: {text}\n出力:",
    input_variables=["text"]
)
```

### 動的プロンプト

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "製品カテゴリ: {category}"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}")
])

chain = prompt | llm | StrOutputParser()

result = chain.invoke({
    "category": "エアコン",
    "history": [
        ("human", "前の質問"),
        ("assistant", "前の回答")
    ],
    "question": "フィルター清掃は？"
})
```

## エラー処理

```python
from langchain_core.runnables import RunnableWithFallbacks

# フォールバック付きチェーン
chain_with_fallback = chain.with_fallbacks([
    fallback_chain,
])

# リトライ
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
async def invoke_with_retry(chain, input_data):
    return await chain.ainvoke(input_data)
```
