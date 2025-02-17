---
title: "RAG Cookbook: Hybrid RAG"
slug: "rag-cookbook-hybrid-rag"
description: "Advanced methods for optimal RAG usage in chatbot applications"
tags:
  - "RAG"
  - "AI"
  - "Cookbook"
date: "2025-02-17"
published: true
---

## Introduction

In our previous articles, we covered basic RAG, retrieve-and-rerank, and validation techniques. This article introduces **Hybrid RAG**, which combines vector search with keyword-based search to improve retrieval accuracy and robustness.

To follow along, you should be familiar with the concepts covered in previous articles. The code changes focus on enhancing the retrieval pipeline by implementing hybrid search while maintaining the same validation framework.

All relevant code changes will be contained in a single commit in the **[GitHub repository](https://github.com/embeddedadam/landing)**.

## Series Overview

This is part of the RAG Cookbook series:

1. **[Introduction to RAG](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook)**
2. **[Retrieve and rerank RAG](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook-retrieve-and-rerank-rag)**
3. **[RAG validation (RAGProbe)](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook-rag-validation)**
4. **[Hybrid RAG (This Article)](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook-hybrid-rag)**
5. **Graph RAG**
6. **Multi-modal RAG**
7. **Agentic RAG (Router)**
8. **Agentic RAG (Multi-agent)**

---

## Table of Contents

- [Introduction](#introduction)
- [Series Overview](#series-overview)
- [Table of Contents](#table-of-contents)
- [Hybrid RAG Explained](#hybrid-rag-explained)
  - [Why Hybrid Search](#why-hybrid-search)
  - [Search Components](#search-components)
  - [Implementation](#implementation)
    - [1. Vector Search](#1-vector-search)
    - [2. Keyword Search](#2-keyword-search)
    - [3. Result Combination](#3-result-combination)
    - [4. System Architecture](#4-system-architecture)
- [Conclusions](#conclusions)
- [References](#references)

---

## Hybrid RAG Explained

**Hybrid RAG** combines dense retrieval (vector search) with sparse retrieval (keyword/BM25 search) to leverage the strengths of both approaches. This combination provides:

1. **Semantic Understanding**: Vector search captures conceptual relationships
2. **Exact Matching**: Keyword search catches specific terms and phrases
3. **Improved Robustness**: Multiple retrieval methods reduce single-point failures

---

### Why Hybrid Search

Single-method retrieval faces several limitations:

1. **Vector Search Limitations**:

   - May miss exact keyword matches
   - Semantic drift in edge cases
   - Computationally intensive

2. **Keyword Search Limitations**:
   - Misses semantic relationships
   - Sensitive to vocabulary mismatch
   - Limited understanding of context

Hybrid search addresses these issues by combining both approaches.

---

### Search Components

The hybrid approach consists of three main components:

1. **Dense Retrieval**:

   - Uses vector embeddings
   - Captures semantic relationships
   - Handles conceptual queries

2. **Sparse Retrieval**:

   - Implements keyword matching
   - Catches exact matches
   - Handles specific terms

3. **Result Fusion**:
   - Combines both result sets
   - Deduplicates matches
   - Reranks final results

---

### Implementation

Our implementation extends the existing RAG system with hybrid search capabilities:

#### 1. Vector Search

```typescript
const vectorResults = await index.query({
  vector: queryEmbedding,
  topK: 15,
  includeMetadata: true,
});
```

#### 2. Keyword Search

```typescript
const keywordResults = await index.query({
  vector: new Array(1536).fill(0),
  topK: 15,
  includeMetadata: true,
  filter: {
    text: { $contains: query.toLowerCase() },
  },
});
```

#### 3. Result Combination

```typescript
const allMatches = [...vectorResults.matches, ...keywordResults.matches];
const uniqueMatches = Array.from(
  new Map(allMatches.map((match) => [match.id, match])).values(),
);
```

#### 4. System Architecture

The implementation follows these key principles:

1. **Parallel Processing**

   - Concurrent vector and keyword searches
   - Efficient resource utilization
   - Optimized response times

2. **Result Fusion**

   - Smart deduplication
   - Score normalization
   - Weighted combination

3. **Quality Control**
   - Relevance scoring
   - Result diversity
   - Context optimization

---

## Conclusions

Hybrid RAG significantly improves retrieval quality by combining the strengths of vector and keyword search. While this adds some complexity, the benefits in robustness and accuracy make it a valuable enhancement for production systems.

The next article will explore Graph RAG, which adds relationship-aware retrieval to our system.

---

## References

- [Hybrid Search: The Best of Both Worlds in RAG](https://www.pinecone.io/learn/hybrid-search-intro/)
- [Dense and Sparse Representation for Information Retrieval](https://arxiv.org/abs/2312.09510)
