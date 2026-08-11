from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.chat import generate_response
from app.database import Base, engine, get_db
from app.models import Conversation, Message
from app.utils import generate_title


app = FastAPI(title="Zenith AI")


# =========================================
# CORS
# =========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# DATABASE
# =========================================

Base.metadata.create_all(bind=engine)


# =========================================
# REQUEST MODELS
# =========================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: int
    message: str
    history: list[ChatMessage] = []


# =========================================
# BASIC ROUTES
# =========================================

@app.get("/")
def root():
    return {
        "message": "Welcome to Zenith AI"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# =========================================
# CHAT
# =========================================

@app.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    # -----------------------------------------
    # Find conversation
    # -----------------------------------------

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == request.conversation_id
        )
        .first()
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }


    # -----------------------------------------
    # Generate title from first message
    # -----------------------------------------

    if conversation.title == "New Conversation":
        conversation.title = generate_title(
            request.message
        )


    # -----------------------------------------
    # Save user message
    # -----------------------------------------

    user_message = Message(
        conversation_id=request.conversation_id,
        role="user",
        content=request.message
    )

    db.add(user_message)
    db.commit()


    # -----------------------------------------
    # Prepare conversation history
    # -----------------------------------------

    history = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.history
    ]


    # -----------------------------------------
    # Generate AI response
    # -----------------------------------------

    response = generate_response(
        request.message,
        history
    )


    # -----------------------------------------
    # Save assistant response
    # -----------------------------------------

    assistant_message = Message(
        conversation_id=request.conversation_id,
        role="assistant",
        content=response
    )

    db.add(assistant_message)
    db.commit()


    # -----------------------------------------
    # Return response
    # -----------------------------------------

    return {
        "conversation_id": request.conversation_id,
        "response": response
    }


# =========================================
# CREATE CONVERSATION
# =========================================

@app.post("/conversations")
def create_conversation(
    db: Session = Depends(get_db)
):
    conversation = Conversation(
        title="New Conversation"
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title
    }


# =========================================
# GET CONVERSATIONS
# =========================================

@app.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db)
):
    conversations = (
        db.query(Conversation)
        .order_by(
            Conversation.updated_at.desc()
        )
        .all()
    )

    return [
        {
            "id": conversation.id,
            "title": conversation.title,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at
        }
        for conversation in conversations
    ]


# =========================================
# GET CONVERSATION MESSAGES
# =========================================

@app.get(
    "/conversations/{conversation_id}/messages"
)
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id
        )
        .order_by(
            Message.created_at.asc()
        )
        .all()
    )

    return [
        {
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at
        }
        for message in messages
    ]