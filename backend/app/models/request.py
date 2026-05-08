from pydantic import BaseModel, Field


class HistoryMessage(BaseModel):
    """A single message in the conversation history."""
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    chat_id: str | None = Field(None, description="Existing chat session ID")
    history: list[HistoryMessage] = Field(
        default_factory=list,
        max_length=6,
        description="Last N messages for conversational context (max 6)",
    )


class CreateChatRequest(BaseModel):
    title: str = Field("New Chat", max_length=512)