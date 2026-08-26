---
name: andrej-karpathy
description: >-
  Expert guidance, heuristics, and engineering practices inspired by Andrej Karpathy.
  Use when designing AI/ML architectures, training neural networks, building LLM OS/agent pipelines,
  writing zero-bloat from-scratch code (nanoGPT, micrograd, llm.c), inspecting datasets/tensors,
  and applying First Principles to AI systems.
---

# Andrej Karpathy Engineering & AI Systems Skill

This skill embodies the core philosophy, mental models, and practical recipes championed by Andrej Karpathy (former Director of AI at Tesla, founding member of OpenAI, creator of `nanoGPT`, `micrograd`, `llm.c`, `minGPT`, and CS231n).

---

## 🧠 1. The Core Karpathy Philosophy

### A. First Principles & Build From Scratch

- **No Black Boxes**: Truly understand every layer of the stack before using higher-level abstractions.
- **Deconstruct the Math**: Understand the forward pass, backward pass, cross-entropy loss, softmax temperature, multi-head self-attention, and positional embeddings down to raw tensor operations.
- **Minimal Dependencies**: Prefer clean, pure, dependency-light code that fits in a single readable file over bloated frameworks.

### B. The LLM as Operating System (Software 2.0)

- **CPU**: The LLM core (transformer weights, reasoning engine).
- **RAM**: Context window (working memory, sliding attention).
- **Disk / Long-Term Storage**: Vector databases, pgvector RAG, filesystem artifacts.
- **Peripherals & I/O**: Tools, calculators, Python REPL, browser, terminals.
- **Multiprocessing**: Collaborating specialized agents with deterministic message passing and human review gates.

---

## 🔬 2. The Step-by-Step Recipe for Building AI Systems

### Step 1: Become One with the Data

- **Always inspect raw data**: Print out sample tokens, dataset rows, prompt interpolations, and embeddings before training or querying.
- **Look for anomalies**: Check character encodings, trailing whitespace, corrupted sequences, and class imbalances.
- **Inspect failures**: When a model produces a bad output, trace the exact prompt, token count, temperature, and retrieved RAG context.

### Step 2: Establish the End-to-End Baseline & Leak-Proof Metric

- Build the simplest possible end-to-end pipeline first (e.g. a naive heuristic, linear baseline, or basic prompt template).
- Fix deterministic seeds for reproducibility.
- Ensure zero data leakage between train/test or retrieval/generation splits.

### Step 3: Overfit a Single Batch (Sanity Check)

- Before training on large datasets or building massive agent chains:
  - Take 1–2 samples.
  - Verify that training loss drops to zero (or that the minimal test case produces the exact expected JSON schema).
  - Verify gradients or response contracts are strictly valid.

### Step 4: Scale Systematically & Monitor

- Track loss curves (train vs validation), perplexity, learning rate schedules (cosine decay with linear warmup), gradient clipping, and token throughput.
- Tune hyperparameters systematically: learning rate, weight decay, batch size, dropout.

### Step 5: Optimize & Remove Bottlenecks

- Memory-bandwidth awareness: KV caching, FlashAttention, kernel fusion, quantization (int8/int4), efficient matrix multiplication layout.

---

## 🛠️ 3. Coding Habits & Conventions

1. **Tensor Shape Annotations**: Always document input and output shapes explicitly:
   ```python
   # x: (B, T, C) where B = batch_size, T = sequence_length, C = embedding_dim
   ```
2. **Crystal-Clear Variable Names**: Use standard mathematical and ML terminology (`logits`, `probs`, `targets`, `loss`, `attn_weights`, `q`, `k`, `v`).
3. **No Unnecessary Abstractions**: Keep implementations flat and readable. If a 50-line self-contained function does the job, don't create 5 abstract classes.
4. **Fast Local Verification**: Write fast, offline unit tests that run in milliseconds without requiring internet access or heavyweight external services.

---

## 🎯 4. When to Activate this Skill

- Building or debugging neural network architectures (`nanoGPT`, `micrograd`, `transformer`, `diffusion`).
- Designing LLM orchestration pipelines, agent operating systems, RAG vector retrieval, and prompt compilers.
- Writing clean, dependency-minimal TypeScript, Python, or C code for ML systems.
- Diagnosing loss divergence, NaN gradients, prompt degradation, or hallucination in agent outputs.
