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


@router.get("/feedback/summary")
async def feedback_summary(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    from app.models.orm import Feedback
    result = await db.execute(
        select(Feedback.rating, func.count(Feedback.id).label("count"))
        .group_by(Feedback.rating)
    )
    rows = result.all()
    summary = {"thumbs_up": 0, "thumbs_down": 0, "total": 0}
    for row in rows:
        if row.rating == 1:
            summary["thumbs_up"] = row.count
        elif row.rating == -1:
            summary["thumbs_down"] = row.count
    summary["total"] = summary["thumbs_up"] + summary["thumbs_down"]
    return summary


@router.get("/{chat_id}/messages")
async def get_messages(chat_id: str, db: AsyncSession = Depends(get_db)):
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


@router.post("/{chat_id}/messages/{message_id}/feedback")
async def submit_feedback(
    chat_id: str,
    message_id: str,
    rating: int,
    db: AsyncSession = Depends(get_db),
):
    from app.models.orm import Feedback
    result = await db.execute(
        select(Message).where(Message.id == message_id, Message.chat_id == chat_id)
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if rating not in (1, -1):
        raise HTTPException(status_code=400, detail="Rating must be 1 (up) or -1 (down)")

    feedback = Feedback(message_id=message_id, rating=rating)
    db.add(feedback)
    await db.commit()
    logger.info("feedback_saved", message_id=message_id, rating=rating)
    return {"status": "ok", "message_id": message_id, "rating": rating}