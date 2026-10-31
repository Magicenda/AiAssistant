import asyncio
from unittest.mock import patch

from services.transcribation_service import AudioService


class _Segment:
    text = " тестовая фраза"


def test_audio_service_uses_fast_local_whisper_profile():
    with patch("services.transcribation_service.WhisperModel") as model_factory:
        model_factory.return_value.transcribe.return_value = ([_Segment()], object())
        service = AudioService(
            model_size="small",
            compute_type="int8",
            cpu_threads=4,
            beam_size=1,
            max_concurrent=1,
            vad_min_silence_ms=500,
        )

        result = asyncio.run(service.recognize_from_bytes(b"audio"))

    model_factory.assert_called_once_with(
        "small",
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        num_workers=1,
    )
    _, options = model_factory.return_value.transcribe.call_args
    assert options["beam_size"] == 1
    assert options["best_of"] == 1
    assert options["vad_filter"] is True
    assert options["vad_parameters"] == {"min_silence_duration_ms": 500}
    assert options["condition_on_previous_text"] is False
    assert options["without_timestamps"] is True
    assert result.status is True
    assert result.text == "тестовая фраза"
