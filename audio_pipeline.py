import mimetypes
import os
from deepgram import DeepgramClient

def get_transcript_from_audio(audio_file_path: str) -> str:
    """
    Transcribes a local audio/video file using Deepgram's Nova-2 model.
    Returns a plain string transcript for Person B.
    """
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise ValueError("DEEPGRAM_API_KEY environment variable is empty or not set.")

    client = DeepgramClient(api_key=api_key)

    try:
        with open(audio_file_path, "rb") as audio_file:
            file_bytes = audio_file.read()

        content_type, _ = mimetypes.guess_type(audio_file_path)

        response = client.listen.v1.media.transcribe_file(
            request=file_bytes,
            model="nova-2",
            smart_format=True,
            utterances=True,
            request_options={"additional_headers": {"content-type": content_type or "application/octet-stream"}},
        )

        channels = response.results.channels
        if not channels or not channels[0].alternatives:
            return ""

        return channels[0].alternatives[0].transcript

    except Exception as e:
        print(f"Error during audio transcription: {e}")
        raise e

if __name__ == "__main__":
    os.environ["DEEPGRAM_API_KEY"] = "DEEPGRAM_API_KEY"

    TEST_AUDIO_PATH = r"C:\Users\Aakarsh\Desktop\lecturelens\sample-speech-5m.mp3"

    print("Checking configuration setup and starting transcription...")
    try:
        transcript = get_transcript_from_audio(TEST_AUDIO_PATH)
        print("\n--- Success! Transcript Output ---")
        print(transcript)
    except Exception as e:
        print(f"\nExecution failed: {e}")