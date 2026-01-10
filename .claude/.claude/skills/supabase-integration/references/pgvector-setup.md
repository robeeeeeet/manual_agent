# pgvector セットアップ

## 有効化

```sql
-- Supabase SQL Editorで実行
CREATE EXTENSION IF NOT EXISTS vector;
```

## テーブル設計

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id UUID REFERENCES appliances(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768),  -- Gemini: 768次元
  metadata JSONB DEFAULT '{}',
  page_number INT,
  chunk_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- コサイン類似度インデックス
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- メタデータ検索用
CREATE INDEX idx_documents_metadata ON documents USING gin(metadata);
```

## 検索関数

```sql
-- 類似ドキュメント検索
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_appliance_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  appliance_id UUID,
  content TEXT,
  page_number INT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.appliance_id,
    d.content,
    d.page_number,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    (filter_appliance_id IS NULL OR d.appliance_id = filter_appliance_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Python実装

### Embedding生成

```python
from langchain_google_genai import GoogleGenerativeAIEmbeddings

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=settings.GEMINI_API_KEY
)

# 単一テキスト
vector = embeddings.embed_query("フィルター清掃の手順")

# 複数テキスト
vectors = embeddings.embed_documents([
    "フィルター清掃の手順",
    "内部クリーン機能の使い方"
])
```

### ドキュメント保存

```python
async def save_document(
    supabase,
    appliance_id: str,
    content: str,
    page_number: int
):
    # Embedding生成
    vector = embeddings.embed_query(content)

    # 保存
    result = supabase.table("documents").insert({
        "appliance_id": appliance_id,
        "content": content,
        "embedding": vector,
        "page_number": page_number,
        "metadata": {"source": "manual_pdf"}
    }).execute()

    return result.data[0]
```

### 類似検索

```python
async def search_documents(
    supabase,
    query: str,
    appliance_id: str = None,
    limit: int = 5
):
    # クエリのEmbedding
    query_vector = embeddings.embed_query(query)

    # RPC呼び出し
    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_vector,
            "match_threshold": 0.7,
            "match_count": limit,
            "filter_appliance_id": appliance_id
        }
    ).execute()

    return result.data
```

## LangChain統合

```python
from langchain_community.vectorstores import SupabaseVectorStore

vectorstore = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)

# 検索
docs = vectorstore.similarity_search(
    "フィルター清掃",
    k=5,
    filter={"appliance_id": appliance_id}
)

# Retrieverとして使用
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5}
)
```

## チャンク分割

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100,
    separators=["\n\n", "\n", "。", "、", " "]
)

# PDFテキストを分割
chunks = splitter.split_text(pdf_text)

# 各チャンクを保存
for i, chunk in enumerate(chunks):
    await save_document(
        supabase,
        appliance_id=appliance_id,
        content=chunk,
        page_number=page_number
    )
```

## パフォーマンス

```sql
-- インデックスリスト数の調整（データ量に応じて）
-- 目安: sqrt(行数)
DROP INDEX idx_documents_embedding;
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 200);  -- 40,000行の場合

-- HNSW（高速だがメモリ消費大）
CREATE INDEX idx_documents_embedding_hnsw ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```
