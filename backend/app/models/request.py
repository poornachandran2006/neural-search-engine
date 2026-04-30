from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    chat_id: str | None = Field(None, description="Existing chat session ID")


class CreateChatRequest(BaseModel):
    title: str = Field("New Chat", max_length=512)