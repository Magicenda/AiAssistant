from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    THINKING = "thinking"
    SPEAKING = "speaking"
    COMPLETED = "completed"
    FAILED = "failed"

class AudioFormat(str, Enum):
    WAV = "audio/wav"
    MP3 = "audio/mp3"
    WEBM = "audio/webm"
