from app.core.logging import get_logger

logger = get_logger(__name__)

_SYSTEM_PROMPT = """You are a precise document intelligence assistant.
Answer the user's question using ONLY the context provided below.
Do not use any external knowledge. Do not speculate or hallucinate.
If the context does not contain enough information to answer, say so explicitly.
Be concise and direct. Cite the source document name when relevant.
When the user asks a follow-up question, use the conversation history
to understand what they are referring to."""


def build_single_doc_prompt(
    query: str,
    chunks: list[dict],
    history: list[dict] | None = None,
) -> list[dict]:
    """
    Assembles the message list for a single-doc Groq call.
    History is inserted between system prompt and final user message
    so the LLM understands conversational follow-ups.
    """
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        source = chunk.get("source_file", "unknown")
        page = chunk.get("page_number", "?")
        context_parts.append(
            f"[Chunk {i} | Source: {source} | Page: {page}]\n{chunk['text']}"
        )

    context = "\n\n---\n\n".join(context_parts)

    # Start with system prompt
    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    # Insert conversation history (last N turns before this query)
    if history:
        messages.extend(history)

    # Final user message: context + current query
    messages.append({
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {query}",
    })

    logger.debug(
        "single_doc_prompt_built",
        chunks=len(chunks),
        context_chars=len(context),
        history_turns=len(history) if history else 0,
    )
    return messages


def build_map_prompt(
    query: str,
    chunks: list[dict],
    source_file: str,
) -> list[dict]:
    """
    Per-document prompt for the MAP step of Map-Reduce.
    No history here — MAP is a document extraction task, not a conversation turn.
    """
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        page = chunk.get("page_number", "?")
        context_parts.append(f"[Chunk {i} | Page: {page}]\n{chunk['text']}")

    context = "\n\n---\n\n".join(context_parts)

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Document: {source_file}\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {query}\n\n"
                "Extract only the information from this document that is relevant "
                "to answering the question. Be concise."
            ),
        },
    ]
    return messages


def build_reduce_prompt(
    query: str,
    per_doc_answers: list[dict],
    history: list[dict] | None = None,
) -> list[dict]:
    """
    Final merge prompt for the REDUCE step of Map-Reduce.
    History is included so the LLM understands follow-up comparisons
    like 'how does that compare to what you said earlier?'
    """
    answers_text = "\n\n---\n\n".join(
        f"[From: {a['source_file']}]\n{a['answer']}"
        for a in per_doc_answers
    )

    # Start with system prompt
    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    # Insert conversation history
    if history:
        messages.extend(history)

    # Final user message: synthesize across documents
    messages.append({
        "role": "user",
        "content": (
            f"The following are partial answers from different documents "
            f"about the question: '{query}'\n\n"
            f"{answers_text}\n\n"
            "Synthesize these into one complete, coherent answer. "
            "Reference the source documents where relevant. "
            "Do not repeat information."
        ),
    })

    return messages