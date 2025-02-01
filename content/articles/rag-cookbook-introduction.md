---
title: "RAG Cookbook: Introduction"
slug: "rag-cookbook"
description: "Advanced methods for optimal RAG usage in chatbot applications"
tags:
  - "RAG"
  - "AI"
  - "Cookbook"
date: "2025-01-28"
published: true
---

## Introduction

I wanted to explain how RAG works, but after some initial thoughts, I realized how this topic grew over the past two years.

This series of articles intends to be a full guide on how to build **production-ready RAG systems**. The amount of knowledge needed to acquire forces us to split it into multiple articles. In the current one, I will explain what RAG is and which key concepts we need to understand to make use of it, followed by a **naive RAG** implementation.

To follow along, you need to have basic engineering skills and brief knowledge of building web applications. I recommend opening the source code to follow the full guide since hands-on learning is more effective compared to reading-only.

Each subsequent article will introduce new types of architectures with gradual improvements over the previous one, allowing us to build on top of the already acquired knowledge. Every code change will be visible on this blog, at the time of article publication.

All relevant code for each article—along with the explanations—will be contained in a **single commit** in my **[GitHub repository](https://github.com/embeddedadam/landing)** to make it easy to locate and follow along.

## Series Overview

This is part of the RAG Cookbook series:

1. **[Introduction to RAG (This Article)](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook)**
2. **[Retrieve and rerank RAG](${process.env.NEXT_PUBLIC_DOMAIN_URL}/articles/rag-cookbook-retrieve-and-rerank-rag)**
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
- [RAG Explained](#rag-explained)
  - [What Is a Vector and Vector Database](#what-is-a-vector-and-vector-database)
  - [Cosine Similarity](#cosine-similarity)
  - [Implementation](#implementation)
    - [1. User Interface Layer](#1-user-interface-layer)
    - [2. RAG Processing Layer](#2-rag-processing-layer)
    - [3. Content Management Layer](#3-content-management-layer)
    - [4. System Architecture](#4-system-architecture)
- [Conclusions](#conclusions)
- [References](#references)

---

## RAG Explained

**RAG** stands for **Retrieval-Augmented Generation**. Imagine you have a ChatGPT-like model but need it to handle private data or highly specialized information not included in the model's original training. One way to achieve this is by **dynamically injecting** relevant chunks of that data into the prompt context.

For example, a user might want to know details from last month's financial report based on their bank statements. Rather than relying solely on an LLM's training data—which may be outdated or lack private documents—a RAG system retrieves the user's relevant bank-statement information from a **vector database** and appends it to the prompt before generating an answer.

A typical **naive RAG** pipeline includes:

1. **Document Ingestion**: Convert documents into embeddings and store them in a vector database.
2. **Query Embedding**: Convert the user's prompt into an embedding using the same embedding model.
3. **Similarity Search**: Retrieve the most similar document embeddings based on a similarity metric (e.g., cosine similarity).
4. **Context Injection**: Pass these retrieved chunks to an LLM as context.
5. **Response**: The LLM uses the retrieved information to generate an answer grounded in the user's private data.

Such an approach ensures we only pass **relevant information** to the LLM, reducing token costs and response latency. However, it can be challenging to build a **good retriever** and configure a vector database so that it **always** retrieves only relevant information.

---

### What Is a Vector and Vector Database

A **vector** is a list of numbers, such as `[0.1, 0.5, -0.3, 0.8, 0.7]`, which can be viewed as a point in high-dimensional space. In language modeling, we use **embeddings**—vectors that capture semantic relationships for text (and potentially images, audio, and more).

A **vector database** stores and indexes these embeddings so that we can efficiently search for "nearest" or most similar vectors. This functionality is crucial for RAG, where you must quickly retrieve the closest matching documents to a user's query. Common vector databases or libraries include [Pinecone](https://www.pinecone.io/), [Milvus](https://milvus.io/), [Weaviate](https://www.weaviate.io/), and [FAISS](https://github.com/facebookresearch/faiss).

---

### Cosine Similarity

To measure how closely two vectors resemble each other, we often use **cosine similarity**, defined as:

$$
\text{cosine\_similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}
$$

Where:

- $A$ and $B$ are vectors
- $A \cdot B$ denotes the dot product
- $\|A\|$ and $\|B\|$ are the magnitudes (Euclidean norms) of $A$ and $B$

A cosine similarity near \(1\) implies strong semantic similarity; a value close to \(-1\) indicates opposing directions (dissimilarity).

---

### Implementation

In this article, we are explaining the **very basics** of a naive RAG setup. Below, each component is introduced with its purpose and role in the system. All code is available in the [GitHub repository](https://github.com/embeddedadam/landing).

#### 1. User Interface Layer

- **Chat Interface** ([`ai-chat-panel.tsx`](https://github.com/embeddedadam/landing/tree/main/app/components/ai-chat/ai-chat-panel.tsx))
  - Provides a floating chat window for user interaction
  - Manages real-time message history and loading states
  - Handles user input and message animations
  - Ensures responsive design across devices

#### 2. RAG Processing Layer

- **Server Action** ([`chat.ts`](https://github.com/embeddedadam/landing/tree/main/app/actions/chat.ts))
  - Implements the core RAG pipeline using Next.js Server Actions
  - Manages vector similarity search through Pinecone
  - Handles OpenAI embeddings and chat completions
  - Processes context retrieval and response generation

#### 3. Content Management Layer

- **Automated Updates** ([`update-embeddings.yml`](https://github.com/embeddedadam/landing/tree/main/.github/workflows/update-embeddings.yml))
  - Maintains vector database synchronization
  - Triggers automatically on content changes
  - Ensures up-to-date article embeddings

#### 4. System Architecture

The implementation follows these key principles:

1. **Vector Search**

   - Uses Pinecone for efficient vector storage and retrieval
   - Implements semantic search using OpenAI embeddings
   - Retrieves top-3 most relevant context chunks

2. **Processing Flow**

   - User query → Vector embedding
   - Similarity search → Context retrieval
   - Context injection → LLM response
   - Response formatting → User display

3. **Error Handling**

   - Implements graceful degradation
   - Provides clear user feedback
   - Maintains detailed logging

4. **Performance**
   - Leverages server-side processing
   - Optimizes context window usage
   - Implements efficient embedding updates
   - Ensures responsive user experience

This implementation serves as a foundation for more sophisticated RAG architectures, which we'll explore in subsequent articles.

---

## Conclusions

RAG provides a **dynamic** method to inject private or specialized data into LLM prompts, enabling more **accurate** and **up-to-date** responses. By retrieving only the **most relevant** context, you can minimize token usage, reduce latency, and keep your data secure.

You still can get wrong answers, ask about not related topics, retrieve wrong data or make model not follow up on previously discussed topics.

Future articles will address **advanced RAG architectures**, testing methodologies (like RAGProbe), and techniques to refine retrieval. Mentioned improvements are needed since the naive RAG implementation is not production ready yet.

You can test it yourself by running the code from the repository or clicking on the right bottom corner of this page to open the chat popover that we implemented in the current article.

---

## References

- [https://arxiv.org/abs/2312.10997](https://arxiv.org/abs/2312.10997)
- [https://docs.langchain4j.dev/tutorials/rag/](https://docs.langchain4j.dev/tutorials/rag/)
