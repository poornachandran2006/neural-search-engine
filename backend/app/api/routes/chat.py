from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.postgres import get_db
from app.models.orm import Chat, Message
from app.models.request import CreateChatRequest
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/chats", tags=["chats"])


@router.post("")
async def create_chat(
    request: CreateChatRequest,
    db: AsyncSession = Depends(get_db),
):
    chat = Chat(title=request.title)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    logger.info("chat_created", chat_id=chat.id)
    return {"id": chat.id, "title": chat.title, "created_at": chat.created_at}


@router.get("")
async def list_chats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chat).order_by(desc(Chat.updated_at)).limit(50)
    )
    chats = result.scalars().all()
    return [
        {"id": c.id, "title": c.title, "created_at": c.created_at, "updated_at": c.updated_at}
        for c in chats
    ]


@router.get("/{chat_id}/messages")
async def get_messages(chat_id: str, db: AsyncSession = Depends(get_db)):
    # Verify chat exists
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    await db.delete(chat)
    await db.commit()
    return {"deleted": chat_id}