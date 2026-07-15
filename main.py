from audio_pipeline import get_transcript_from_audio
from llm_structure import transform_transcript_to_mindmap

MIN_TRANSCRIPT_CHARS = 30


def run_pipeline(audio_file_path):
    raw_text = get_transcript_from_audio(audio_file_path)

    if len(raw_text.strip()) < MIN_TRANSCRIPT_CHARS:
        raise ValueError(
            "No speech could be detected in that recording. Please check your microphone "
            "and try recording again."
        )

    structured_json = transform_transcript_to_mindmap(raw_text)

    return structured_json


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run the LectureLens transcription and mind map pipeline.")
    parser.add_argument("audio_file_path", help="Path to an audio or video file to process")
    args = parser.parse_args()

    result = run_pipeline(args.audio_file_path)
    print(result.model_dump_json(indent=2))