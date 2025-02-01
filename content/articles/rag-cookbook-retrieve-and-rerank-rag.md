---
title: "RAG Cookbook: Retrieve and rerank"
slug: "rag-cookbook-retrieve-and-rerank-rag"
description: "Advanced methods for optimal RAG usage in chatbot applications"
tags:
  - "RAG"
  - "AI"
  - "Cookbook"
date: "2025-02-01"
published: true
---

## Introduction

In our previous article, we implemented a naive RAG system. While functional, it had limitations in retrieval accuracy and result quality. This article introduces **retrieve and rerank**, a powerful technique to improve RAG systems by implementing a two-stage retrieval process.

To follow along, you should be familiar with the basic RAG concepts covered in the introduction article. The code changes will focus on enhancing the retrieval pipeline while maintaining the same user interface.

All relevant code changes will be contained in a single commit in the **[GitHub repository](https://github.com/embeddedadam/landing)**.

## Series Overview

This is part of the RAG Cookbook series:

1. **[Introduction to RAG](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook)**
2. **[Retrieve and rerank RAG (This Article)](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook-retrieve-and-rerank-rag)**
3. **RAG validation (RAGProbe)**
4. **Hybrid RAG**
5. **Graph RAG**
6. **Multi-modal RAG**
7. **Agentic RAG (Router)**
8. **Agentic RAG (Multi-agent)**

---

## Table of Contents

- [Introduction](#introduction)
- [Series Overview](#series-overview)
- [Table of Contents](#table-of-contents)
- [Retrieve and Rerank Explained](#retrieve-and-rerank-explained)
  - [Why Two-Stage Retrieval](#why-two-stage-retrieval)
  - [Bi-Encoders vs Cross-Encoders](#bi-encoders-vs-cross-encoders)
  - [Implementation](#implementation)
    - [1. Initial Retrieval Stage](#1-initial-retrieval-stage)
    - [2. Reranking Stage](#2-reranking-stage)
    - [3. System Architecture](#3-system-architecture)
- [Conclusions](#conclusions)
- [References](#references)

---

## Retrieve and Rerank Explained

**Retrieve and rerank** is a two-stage approach to information retrieval that combines the efficiency of initial retrieval with the accuracy of detailed reranking. The process works as follows:

1. **Initial Retrieval**: Use a fast retrieval method (bi-encoder) to get a larger set of potentially relevant documents
2. **Reranking**: Apply a more sophisticated model (cross-encoder) to rerank the initial results for better accuracy

This approach balances the trade-off between speed and accuracy, making it particularly effective for production RAG systems.

---

### Why Two-Stage Retrieval

Single-stage retrieval faces several challenges:

1. **Efficiency vs Accuracy**: More accurate models are often too slow for initial retrieval
2. **Context Length**: Limited context windows require careful document selection
3. **Semantic Understanding**: Simple similarity metrics may miss nuanced relationships

Two-stage retrieval addresses these issues by:

1. Using fast initial retrieval to narrow down candidates
2. Applying detailed analysis only to promising documents
3. Leveraging cross-attention for better semantic understanding

---

### Bi-Encoders vs Cross-Encoders

**Bi-Encoders**:

- Encode query and documents independently
- Fast retrieval through vector similarity
- Suitable for large-scale initial retrieval
- Less accurate than cross-encoders

**Cross-Encoders**:

- Process query and document pairs together
- Use cross-attention for better understanding
- More accurate but slower
- Perfect for reranking small candidate sets

---

### Implementation

- **Server Action** ([`chat.ts`](https://github.com/embeddedadam/landing/tree/main/app/actions/chat.ts))

#### 1. Initial Retrieval Stage

- Uses bi-encoder model for embedding generation
- Retrieves top-k candidates (typically 100 in this case 10)
- Implements efficient vector search

#### 2. Reranking Stage

- Applies cross-encoder to candidate pairs
- Produces relevance scores for each pair
- Reorders results based on detailed analysis

#### 3. System Architecture

The implementation follows these key principles:

1. **Two-Stage Pipeline**

   - Initial retrieval using vector search
   - Reranking using cross-encoder
   - Final result selection

2. **Model Selection**

   - Bi-encoder: MPNet or similar for embeddings
   - Cross-encoder: Specialized reranking model
   - Balanced performance characteristics

3. **Performance Optimization**

   - Batched processing for reranking
   - Caching of intermediate results
   - Efficient resource utilization

4. **Quality Control**
   - Score thresholding for relevance
   - Diversity in result set
   - Confidence metrics

---

## Conclusions

Retrieve and rerank significantly improves RAG system quality by combining efficient initial retrieval with accurate reranking. While this adds some complexity and computational overhead, the benefits in result quality often justify the trade-offs.

The next article will explore how to validate RAG systems, using RAGProbe.

---

## References

- [Understanding RAG III: Fusion Retrieval and Reranking](https://machinelearningmastery.com/understanding-rag-iii-fusion-retrieval-and-reranking/)
- [Sentence Transformers: Retrieve & Re-Rank](https://sbert.net/examples/applications/retrieve_rerank/README.html)
