from datetime import datetime
from pathlib import Path
import os

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    RedirectResponse,
    StreamingResponse,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request

from jose import jwt

from app.chat import (
    generate_response,
    generate_response_stream,
)
from app.database import Base, engine, get_db
from app.models import (
    User,
    Conversation,
    Message,
    Document,
)
from app.utils import generate_title
from app.documents import extract_text
from app.web_search import search_web


# =========================================================
# APP
# =========================================================

app = FastAPI(title="Zenith AI")


# =========================================================
# CONFIG
# =========================================================

SECRET_KEY = "zenith-super-secret-key-change-later"
ALGORITHM = "HS256"

FRONTEND_URL = "http://localhost:5173"
BACKEND_URL = "http://localhost:8000"

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# GOOGLE OAUTH
# =========================================================

config = Config(".env")

oauth = OAuth(config)

oauth.register(
    name="google",
    client_id=config("GOOGLE_CLIENT_ID"),
    client_secret=config("GOOGLE_CLIENT_SECRET"),
    server_metadata_url=(
        "https://accounts.google.com/"
        ".well-known/openid-configuration"
    ),
    client_kwargs={
        "scope": "openid email profile"
    },
)


# =========================================================
# MIDDLEWARE
# =========================================================

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="lax",
    https_only=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE
# =========================================================
os.makedirs("uploads", exist_ok=True)
Base.metadata.create_all(bind=engine)


# =========================================================
# REQUEST MODELS
# =========================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: int
    message: str
    history: list[ChatMessage] = []
    document_text: str = ""


# =========================================================
# HELPERS
# =========================================================

def get_current_user(
    request: Request,
    db: Session,
):
    """
    Returns the logged-in Google user.

    If nobody is logged in, creates/returns
    one local guest account.

    This means New Session works without Google.
    """

    user_id = request.session.get("user_id")

    if user_id:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if user:
            return user

    # -----------------------------------------------------
    # Guest account
    # -----------------------------------------------------

    guest_email = "guest@zenith.local"

    guest = (
        db.query(User)
        .filter(User.email == guest_email)
        .first()
    )

    if not guest:
        guest = User(
            username="guest",
            email=guest_email,
            hashed_password="GUEST_USER",
        )

        db.add(guest)
        db.commit()
        db.refresh(guest)

    return guest


def get_conversation_for_user(
    conversation_id: int,
    user,
    db: Session,
):
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
        .first()
    )


def should_search_web(message: str) -> bool:
    keywords = [
        "latest",
        "current",
        "today",
        "now",
        "news",
        "recent",
        "search",
        "online",
        "internet",
        "what happened",
        "price",
        "weather",
    ]

    message_lower = message.lower()

    return any(
        keyword in message_lower
        for keyword in keywords
    )


# =========================================================
# BASIC ROUTES
# =========================================================

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


# =========================================================
# AUTH - GOOGLE LOGIN
# =========================================================

@app.get("/auth/google")
async def google_login(
    request: Request,
):
    redirect_uri = (
        f"{BACKEND_URL}/auth/google/callback"
    )

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
    )


@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        token = await oauth.google.authorize_access_token(
            request
        )

        user_info = token.get("userinfo")

        if not user_info:
            return {
                "error": "Could not retrieve Google user information"
            }

        email = user_info.get("email")
        name = user_info.get("name")

        if not email:
            return {
                "error": "Google account email not available"
            }

        # -------------------------------------------------
        # Existing user
        # -------------------------------------------------

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        # -------------------------------------------------
        # New user
        # -------------------------------------------------

        if not user:
            username = (
                name.replace(" ", "_").lower()
                if name
                else email.split("@")[0]
            )

            existing_username = (
                db.query(User)
                .filter(
                    User.username == username
                )
                .first()
            )

            if existing_username:
                username = (
                    f"{username}_"
                    f"{email.split('@')[0]}"
                )

            user = User(
                username=username,
                email=email,
                hashed_password="GOOGLE_AUTH",
            )

            db.add(user)
            db.commit()
            db.refresh(user)

        # -------------------------------------------------
        # Session
        # -------------------------------------------------

        request.session.clear()

        request.session["user_id"] = user.id

        # -------------------------------------------------
        # JWT
        # -------------------------------------------------

        access_token = jwt.encode(
            {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

        # -------------------------------------------------
        # Redirect
        # -------------------------------------------------

        redirect_url = (
            f"{FRONTEND_URL}"
            f"?token={access_token}"
            f"&user_id={user.id}"
            f"&username={user.username}"
            f"&email={user.email}"
        )

        return RedirectResponse(
            url=redirect_url
        )

    except Exception as error:
        print(
            f"Google authentication error: {error}"
        )

        return {
            "error": "Google authentication failed",
            "details": str(error),
        }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/auth/me")
def current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    user_id = request.session.get("user_id")

    if not user_id:
        return {
            "authenticated": False,
            "user": None,
        }

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        return {
            "authenticated": False,
            "user": None,
        }

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }


# =========================================================
# LOGOUT
# =========================================================

@app.post("/auth/logout")
def logout(
    request: Request,
):
    request.session.clear()

    return {
        "success": True
    }


# =========================================================
# CONVERSATIONS - GET
# =========================================================

@app.get("/conversations")
def get_conversations(
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user.id
        )
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
            "updated_at": conversation.updated_at,
            "user_id": conversation.user_id,
        }
        for conversation in conversations
    ]


# =========================================================
# CONVERSATIONS - CREATE
# =========================================================

@app.post("/conversations")
def create_conversation(
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = Conversation(
        title="New Conversation",
        user_id=user.id,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title,
        "user_id": conversation.user_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }


# =========================================================
# CONVERSATION - RENAME
# =========================================================

@app.put("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: int,
    request: Request,
    title: str = Form(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    title = title.strip()

    if not title:
        return {
            "error": "Title cannot be empty"
        }

    conversation.title = title

    db.commit()
    db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title,
    }


# =========================================================
# CONVERSATION - DELETE
# =========================================================

@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    db.delete(conversation)
    db.commit()

    return {
        "success": True
    }


# =========================================================
# GET CONVERSATION MESSAGES
# =========================================================

@app.get(
    "/conversations/{conversation_id}/messages"
)
def get_messages(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id ==
            conversation_id
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
            "created_at": message.created_at,
        }
        for message in messages
    ]


# =========================================================
# DOCUMENTS - GET
# =========================================================

@app.get(
    "/conversations/{conversation_id}/documents"
)
def get_documents(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    documents = (
        db.query(Document)
        .filter(
            Document.conversation_id ==
            conversation_id
        )
        .order_by(
            Document.id.desc()
        )
        .all()
    )

    return [
        {
            "id": document.id,
            "filename": document.filename,
            "file_type": document.file_type,
            "characters": document.characters,
            "conversation_id":
                document.conversation_id,
            "text": document.text,
        }
        for document in documents
    ]


# =========================================================
# DOCUMENT - OPEN
# =========================================================

@app.get("/documents/{document_id}/file")
def open_document(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    document = (
        db.query(Document)
        .join(
            Conversation,
            Conversation.id ==
            Document.conversation_id,
        )
        .filter(
            Document.id == document_id,
            Conversation.user_id == user.id,
        )
        .first()
    )

    if not document:
        return {
            "error": "Document not found"
        }

    file_path = (
        UPLOAD_DIR /
        document.filename
    )

    if not file_path.exists():
        return {
            "error": "Physical file not found"
        }

    extension = (
        file_path.suffix.lower()
    )

    media_types = {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".docx": (
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
    }

    return StreamingResponse(
        open(
            file_path,
            "rb",
        ),
        media_type=media_types.get(
            extension,
            "application/octet-stream",
        ),
        headers={
            "Content-Disposition": (
                f'inline; filename="{document.filename}"'
            )
        },
    )


# =========================================================
# UPLOAD DOCUMENT
# =========================================================

@app.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    conversation_id: int = Form(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
    }

    filename = file.filename or ""

    extension = (
        "."
        + filename.split(".")[-1].lower()
        if "." in filename
        else ""
    )

    if extension not in allowed_extensions:
        return {
            "error": (
                "Unsupported file type. "
                "Supported formats: PDF, DOCX, TXT."
            )
        }

    safe_filename = (
        f"{datetime.utcnow().timestamp()}_"
        f"{Path(filename).name}"
    )

    upload_path = (
        UPLOAD_DIR /
        safe_filename
    )

    contents = await file.read()

    with open(
        upload_path,
        "wb",
    ) as buffer:
        buffer.write(contents)

    try:
        text = extract_text(
            str(upload_path),
            filename,
        )

    except Exception as error:
        if upload_path.exists():
            upload_path.unlink()

        return {
            "error": (
                f"Failed to extract text: {error}"
            )
        }

    document = Document(
        conversation_id=conversation_id,
        filename=safe_filename,
        file_type=extension,
        characters=len(text),
        text=text,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "filename": filename,
        "file_type": extension,
        "characters": len(text),
        "text": text,
        "conversation_id":
            conversation_id,
    }


# =========================================================
# CHAT
# =========================================================

@app.post("/chat")
def chat(
    request_data: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        request_data.conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    # -----------------------------------------------------
    # Title
    # -----------------------------------------------------

    if conversation.title == "New Conversation":
        try:
            conversation.title = generate_title(
                request_data.message
            )
        except Exception:
            conversation.title = (
                request_data.message[:50]
            )

    # -----------------------------------------------------
    # Save user message
    # -----------------------------------------------------

    user_message = Message(
        conversation_id=
            request_data.conversation_id,
        role="user",
        content=request_data.message,
    )

    db.add(user_message)
    db.commit()

    # -----------------------------------------------------
    # History
    # -----------------------------------------------------

    history = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in request_data.history
    ]

    # -----------------------------------------------------
    # Document context
    # -----------------------------------------------------

    document_context = (
        request_data.document_text.strip()
    )

    enhanced_message = request_data.message

    if document_context:
        enhanced_message = f"""
You have access to the following uploaded document.

DOCUMENT:
--------------------
{document_context}
--------------------

Use the document above to answer the user's question.

If the answer is not contained in the document,
say so clearly.

USER QUESTION:
{request_data.message}
"""

    # -----------------------------------------------------
    # Web search
    # -----------------------------------------------------

    web_context = ""
    results = []

    if should_search_web(
        request_data.message
    ):
        try:
            results = search_web(
                request_data.message,
                max_results=5,
            )

            if results:
                web_context = "\n\n".join(
                    [
                        (
                            f"TITLE: {result['title']}\n"
                            f"URL: {result['url']}\n"
                            f"CONTENT: {result['snippet']}"
                        )
                        for result in results
                    ]
                )

        except Exception as error:
            print(
                f"Web search failed: {error}"
            )

    if web_context:
        enhanced_message = f"""
Use the following web search results to answer
the user's question.

WEB SEARCH RESULTS:
--------------------
{web_context}
--------------------

Use the search results as current information.
When appropriate, mention the relevant source.

USER QUESTION:
{request_data.message}
"""

    # -----------------------------------------------------
    # AI
    # -----------------------------------------------------

    response = generate_response(
        enhanced_message,
        history,
    )

    # -----------------------------------------------------
    # Save assistant
    # -----------------------------------------------------

    assistant_message = Message(
        conversation_id=
            request_data.conversation_id,
        role="assistant",
        content=response,
    )

    db.add(assistant_message)

    conversation.updated_at = datetime.utcnow()

    db.commit()

    return {
        "conversation_id":
            request_data.conversation_id,
        "response": response,
        "web_search":
            bool(web_context),
        "sources": [
            {
                "title": result["title"],
                "url": result["url"],
            }
            for result in results
        ]
        if web_context
        else [],
    }


# =========================================================
# STREAMING CHAT
# =========================================================

@app.post("/chat/stream")
def chat_stream(
    request_data: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_current_user(
        request,
        db,
    )

    conversation = get_conversation_for_user(
        request_data.conversation_id,
        user,
        db,
    )

    if not conversation:
        return {
            "error": "Conversation not found"
        }

    # -----------------------------------------------------
    # Title
    # -----------------------------------------------------

    if conversation.title == "New Conversation":
        try:
            conversation.title = generate_title(
                request_data.message
            )
        except Exception:
            conversation.title = (
                request_data.message[:50]
            )

    # -----------------------------------------------------
    # Save user message
    # -----------------------------------------------------

    user_message = Message(
        conversation_id=
            request_data.conversation_id,
        role="user",
        content=request_data.message,
    )

    db.add(user_message)
    db.commit()

    # -----------------------------------------------------
    # History
    # -----------------------------------------------------

    history = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in request_data.history
    ]

    # -----------------------------------------------------
    # Document context
    # -----------------------------------------------------

    document_context = (
        request_data.document_text.strip()
    )

    enhanced_message = request_data.message

    if document_context:
        enhanced_message = f"""
You have access to the following uploaded document.

DOCUMENT:
--------------------
{document_context}
--------------------

Use the document above to answer the user's question.

If the answer is not contained in the document,
say so clearly.

USER QUESTION:
{request_data.message}
"""

    # -----------------------------------------------------
    # Web search
    # -----------------------------------------------------

    results = []

    if should_search_web(
        request_data.message
    ):
        try:
            results = search_web(
                request_data.message,
                max_results=5,
            )

            if results:
                web_context = "\n\n".join(
                    [
                        (
                            f"TITLE: {result['title']}\n"
                            f"URL: {result['url']}\n"
                            f"CONTENT: {result['snippet']}"
                        )
                        for result in results
                    ]
                )

                enhanced_message = f"""
Use the following web search results to answer
the user's question.

WEB SEARCH RESULTS:
--------------------
{web_context}
--------------------

Use the search results as current information.

USER QUESTION:
{request_data.message}
"""

        except Exception as error:
            print(
                f"Web search failed: {error}"
            )

    # -----------------------------------------------------
    # Generator
    # -----------------------------------------------------

    def generate_and_save():
        full_response = ""

        try:
            for chunk in generate_response_stream(
                enhanced_message,
                history,
            ):
                full_response += chunk
                yield chunk

            assistant_message = Message(
                conversation_id=
                    request_data.conversation_id,
                role="assistant",
                content=full_response,
            )

            db.add(assistant_message)

            conversation.updated_at = (
                datetime.utcnow()
            )

            db.commit()

        except Exception as error:
            db.rollback()

            print(
                f"Streaming error: {error}"
            )

            raise

    return StreamingResponse(
        generate_and_save(),
        media_type="text/plain",
    )