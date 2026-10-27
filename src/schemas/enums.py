from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AudioFormat(str, Enum):
    WAV = "audio/wav"
    MP3 = "audio/mp3"
    WEBM = "audio/webm"
