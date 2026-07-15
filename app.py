import os
import re
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import db
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from llm_structure import LectureMindMap, generate_study_questions
from main import run_pipeline

load_dotenv()

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

ALLOWED_UPLOAD_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm", ".ogg", ".oga", ".flac", ".aac", ".mkv", ".avi",
    ".mpeg", ".mpg", ".m2v", ".mp2",
}
MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="LectureLens API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LectureMindMapResponse(LectureMindMap):
    id: str
    duration_seconds: Optional[float] = None


class NodeUpdate(BaseModel):
    bookmarked: Optional[bool] = None
    notes: Optional[str] = None


def _safe_temp_path(filename: Optional[str]) -> str:
    """Builds a random temp filename, never trusting the client-supplied one directly (path traversal)."""
    ext = os.path.splitext(filename or "")[1]
    ext = re.sub(r"[^A-Za-z0-9.]", "", ext)[:10].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext or 'unknown'}'.")
    return f"temp_{uuid.uuid4().hex}{ext}"


async def _save_upload(file: UploadFile, dest_path: str) -> None:
    size = 0
    with open(dest_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="File too large (max 500MB).")
            buffer.write(chunk)


@app.post("/process-audio", response_model=LectureMindMapResponse)
async def process_audio(file: UploadFile = File(...), duration_seconds: Optional[float] = Form(None)):
    temp_file_path = _safe_temp_path(file.filename)

    try:
        await _save_upload(file, temp_file_path)

        print(f"[API] Processing audio file: {file.filename}...")
        mind_map_data = run_pipeline(temp_file_path)

        if not mind_map_data:
            raise HTTPException(status_code=400, detail="The pipeline returned no mind map data.")

        lecture_id = db.create_lecture(mind_map_data, duration_seconds, file.filename)

        return LectureMindMapResponse(
            id=lecture_id,
            duration_seconds=duration_seconds,
            **mind_map_data.model_dump(),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[API ERROR] {e}")
        detail = str(e) if DEBUG else "Internal server error while processing the file."
        raise HTTPException(status_code=500, detail=detail)

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.get("/lectures")
async def list_lectures():
    return db.list_lectures()


@app.get("/lectures/{lecture_id}")
async def get_lecture(lecture_id: str):
    lecture = db.get_lecture(lecture_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    return lecture


@app.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str):
    deleted = db.delete_lecture(lecture_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    return {"deleted": True}


@app.patch("/lectures/{lecture_id}/nodes/{node_id}")
async def patch_node(lecture_id: str, node_id: str, update: NodeUpdate):
    if db.get_lecture(lecture_id) is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    node = db.update_node(lecture_id, node_id, bookmarked=update.bookmarked, notes=update.notes)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found.")
    return node


@app.get("/lectures/{lecture_id}/study")
async def get_study_questions(lecture_id: str):
    lecture = db.get_lecture(lecture_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    cached = db.get_cached_study_questions(lecture_id)
    if cached is not None:
        return {"questions": cached}

    if not lecture["nodes"]:
        return {"questions": []}

    try:
        result = generate_study_questions(lecture["lecture_title"], lecture["nodes"])
        questions = [q.model_dump() for q in result.questions]
    except Exception as e:
        print(f"[API ERROR] study question generation failed: {e}")
        detail = str(e) if DEBUG else "Couldn't generate study questions right now."
        raise HTTPException(status_code=500, detail=detail)

    db.save_study_questions(lecture_id, questions)
    return {"questions": questions}


@app.get("/stats")
async def get_stats():
    return db.get_stats()


@app.get("/bookmarks")
async def list_bookmarks():
    return db.list_bookmarks()


# Serve the built React frontend (frontend/dist, produced by `npm run build`).
# Mounted last so it acts as a fallback and never shadows the API routes above.
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
