from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLITED = "complited"
    FAILED = "failed"

class RecordType(str,Enum):
    TASK = "Task"
    MEETING = "Meeting"

class AudioFormat(str, Enum):
    WAV = "audio/wav"
    MP3 = "audio/mp3"
    WEBM = "audio/webm"

class IntentType(str, Enum):
    CREATE_TASK = "create_task"          
    CREATE_MEETING = "create_meeting"    
    GET_SCHEDULE = "get_schedule"        
    SEARCH_EVENTS = "search_events"     
    UNKNOWN = "unknown"