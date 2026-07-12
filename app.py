import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import Person A's pipeline and your pipeline
from audio_pipeline import get_transcript_from_audio
from llm_structure import transform_transcript_to_mindmap, LectureMindMap

# Load environment variables from your .env file
load_dotenv()

app = FastAPI(title="LectureLens API")

# Allow the frontend (Person C) to connect without CORS errors
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-audio", response_model=LectureMindMap)
async def process_audio(file: UploadFile = File(...)):
    # 1. Create a safe local temporary file path
    temp_file_path = f"temp_{file.filename}"
    
    try:
        # 2. Save incoming uploaded bytes from the frontend
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 3. Run Person A's Deepgram Audio-to-Text code
        print(f"[API] Transcribing audio file: {file.filename}...")
        raw_transcript = get_transcript_from_audio(temp_file_path)
        
        if not raw_transcript:
            raise HTTPException(status_code=400, detail="Deepgram returned an empty transcript.")

        # 4. Run Your Groq Mindmap Constructor code
        print("[API] Structuring text with Groq Llama-3.3...")
        mind_map_data = transform_transcript_to_mindmap(raw_transcript)
        
        return mind_map_data

    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up: delete the temporary file from your laptop
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    # This fires up the persistent web server
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)