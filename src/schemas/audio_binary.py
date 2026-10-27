from pydantic import BaseModel, Field, field_validator

from .enums import AudioFormat


class AudioFileMetadata(BaseModel):
    file_id: str = Field(...,description="Уникальный id файла")
    original_filename: str = Field(..., description="исходное имя полученного файла")
    content_type: AudioFormat = Field(..., description="MIME_type файла")
    size_bytes: int = Field(..., gt=0, le=25*1024*1024,description="Максимальный размер файла 25мб")

    @field_validator("content_type", mode="before")
    @classmethod
    def clean_mime_type(cls, v: str) -> str:
        if isinstance(v, str):
            return v.split(";")[0].strip().lower()
        return v
