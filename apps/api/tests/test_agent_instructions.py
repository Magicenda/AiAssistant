from pydantic import ValidationError

from schemas.tool import CreateTaskArgs
from services.agent_service import SYSTEM_PROMPT
from tools.base import to_gigachat_schema


def test_system_prompt_distinguishes_undated_and_incomplete_task_deadlines():
    assert "Каждая задача без исключений должна иметь" in SYSTEM_PROMPT
    assert "Если пользователь не указал дату" in SYSTEM_PROMPT
    assert "Если пользователь указал дату, но не указал время" in SYSTEM_PROMPT
    assert "Если пользователь отказывается назвать срок, не создавай задачу" in SYSTEM_PROMPT


def test_create_task_schema_repeats_deadline_rules_for_the_model():
    schema = to_gigachat_schema(CreateTaskArgs.model_json_schema())
    deadline_description = schema["properties"]["deadline"]["description"]

    assert "Обязательный срок" in deadline_description
    assert "сначала уточни их" in deadline_description
    assert set(schema["required"]) == {"description", "deadline"}


def test_create_task_rejects_missing_deadline():
    try:
        CreateTaskArgs(description="Купить корм")
    except ValidationError as error:
        assert error.errors()[0]["loc"] == ("deadline",)
    else:
        raise AssertionError("CreateTaskArgs принял задачу без обязательного срока")
