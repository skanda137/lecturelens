import os
from deepgram import DeepgramClient

def get_transcript_from_audio(audio_file_path: str) -> str:
    """
    Transcribes a local audio/video file using Deepgram's Nova-2 model.
    Returns a plain string transcript for Person B.
    """
    # 1. Fetch the API key string directly from the environment context
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise ValueError("DEEPGRAM_API_KEY environment variable is empty or not set.")
        
    # Force the client to use the key explicitly
    client = DeepgramClient(api_key=api_key)

    try:
        # 2. Open the audio file and read its raw bytes
        with open(audio_file_path, "rb") as audio_file:
            file_bytes = audio_file.read()

        # 3. Request the transcription using strict keyword arguments
        response = client.listen.v1.media.transcribe_file(
            request=file_bytes,
            model="nova-2",
            smart_format=True,
            utterances=True
        )

        # 4. Extract and return the plain string transcript
        channels = response.results.channels
        if not channels or not channels[0].alternatives:
            return ""

        return channels[0].alternatives[0].transcript

    except Exception as e:
        print(f"Error during audio transcription: {e}")
        raise e

if __name__ == "__main__":
    # 1. PASTE YOUR KEY HERE (Replace the text inside the quotes with your dg_... key)
    os.environ["DEEPGRAM_API_KEY"] = "DEEPGRAM_API_KEY"
    
    # 2. File verification and execution
    TEST_AUDIO_PATH = r"C:\Users\Aakarsh\Desktop\lecturelens\sample-speech-5m.mp3" 
    
    print("Checking configuration setup and starting transcription...")
    try:
        transcript = get_transcript_from_audio(TEST_AUDIO_PATH)
        print("\n--- Success! Transcript Output ---")
        print(transcript)
    except Exception as e:
        print(f"\nExecution failed: {e}")