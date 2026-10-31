"""Клиенты LLM с единым интерфейсом для GigaChat и OpenAI-совместимых серверов."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
from gigachat import GigaChat

from core.config import settings
from schemas.model_settings import ModelSettings


class LLMClient(Protocol):
    """Минимальный интерфейс, который использует AgentService."""

    async def create(self, payload: dict) -> Any: ...

    def stream(self, payload: dict) -> AsyncIterator[StreamDelta]: ...

    async def aclose(self) -> None: ...


class GigaChatClient:
    """GigaChat через официальный SDK: payload и ответ остаются в его формате."""

    def __init__(self) -> None:
        # Значения передаём явно: тогда дефолты из core/config.py работают
        # и без GIGACHAT_* в окружении.
        self._client = GigaChat(
            credentials=settings.gigachat_credentials or None,
            scope=settings.gigachat_scope,
            model=settings.gigachat_model,
            timeout=settings.llm_timeout,
            max_retries=settings.gigachat_max_retries,
            verify_ssl_certs=settings.gigachat_verify_ssl_certs,
        )

    async def create(self, payload: dict) -> Any:
        return await self._client.achat.create(payload)

    async def stream(self, payload: dict) -> AsyncIterator["StreamDelta"]:
        call_name = ""
        call_arguments: Any = None
        assistant_parts: list[dict] = []

        async for chunk in self._client.achat.stream(payload):
            for message in chunk.messages or []:
                for part in message.content or []:
                    if part.text:
                        assistant_parts.append(part.model_dump(exclude_none=True, by_alias=True))
                        yield StreamDelta(text=part.text)
                    if part.function_call:
                        assistant_parts.append(part.model_dump(exclude_none=True, by_alias=True))
                        call_name = part.function_call.name or call_name
                        call_arguments = _merge_arguments(
                            call_arguments, part.function_call.arguments
                        )

        if call_name:
            yield StreamDelta(
                function_call=_FunctionCall(call_name, call_arguments),
                assistant_message={"role": "assistant", "content": assistant_parts},
            )

    async def aclose(self) -> None:
        await self._client.aclose()


@dataclass
class _TextPart:
    text: str
    # AgentService проверяет function_call у каждой части контента.
    function_call: None = None


@dataclass
class _FunctionCall:
    name: str
    arguments: dict | None


@dataclass
class StreamDelta:
    """Один шаг потока: текст, финальный вызов инструмента или готовое сообщение."""

    text: str = ""
    function_call: _FunctionCall | None = None
    assistant_message: dict | None = None


@dataclass
class _Message:
    """Ответ в форме, которую AgentService ждёт от GigaChat."""

    role: str
    content: list[_TextPart] = field(default_factory=list)
    function_call: _FunctionCall | None = None
    name: str | None = None

    def model_dump(self, exclude_none: bool = False, by_alias: bool = False, **_: Any) -> dict:
        data: dict[str, Any] = {"role": self.role, "content": "".join(p.text for p in self.content)}
        if self.function_call is not None:
            data["function_call"] = {
                "name": self.function_call.name,
                "arguments": self.function_call.arguments,
            }
        if self.name:
            data["name"] = self.name
        if exclude_none:
            data = {key: value for key, value in data.items() if value is not None}
        return data


@dataclass
class _Completion:
    messages: list[_Message]


class OpenAICompatibleClient:
    """Клиент для Ollama и LM Studio: они говорят на OpenAI Chat Completions."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._http = httpx.AsyncClient(timeout=timeout)

    async def create(self, payload: dict) -> _Completion:
        response = await self._http.post(
            f"{self._base_url}/chat/completions",
            json=self._to_request(payload),
            headers={"Authorization": f"Bearer {self._api_key}"},
        )
        response.raise_for_status()
        return self._from_response(response.json())

    async def stream(self, payload: dict) -> AsyncIterator[StreamDelta]:
        request = self._to_request(payload)
        request["stream"] = True
        call_name = ""
        call_arguments = ""
        text_parts: list[str] = []

        async with self._http.stream(
            "POST",
            f"{self._base_url}/chat/completions",
            json=request,
            headers={"Authorization": f"Bearer {self._api_key}"},
        ) as response:
            response.raise_for_status()
            if "text/event-stream" not in (response.headers.get("content-type") or ""):
                # Некоторые OpenAI-совместимые серверы игнорируют stream=true.
                completion = self._from_response(await response.json())
                message = completion.messages[-1]
                if message.content:
                    text = "".join(part.text for part in message.content)
                    text_parts.append(text)
                    yield StreamDelta(text=text)
                if message.function_call:
                    yield StreamDelta(
                        function_call=message.function_call,
                        assistant_message={
                            "role": "assistant",
                            "content": "".join(text_parts) or None,
                            "function_call": {
                                "name": message.function_call.name,
                                "arguments": message.function_call.arguments,
                            },
                        },
                    )
                return

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except ValueError:
                    continue
                choices = event.get("choices") or []
                if not choices:
                    continue
                delta = (choices[0] or {}).get("delta") or {}
                text = delta.get("content")
                if text:
                    text_parts.append(text)
                    yield StreamDelta(text=text)
                for tool_call in delta.get("tool_calls") or []:
                    function = tool_call.get("function") or {}
                    if function.get("name"):
                        call_name = function["name"]
                    fragment = function.get("arguments")
                    if isinstance(fragment, str):
                        call_arguments = (
                            (call_arguments if isinstance(call_arguments, str) else "")
                            + fragment
                        )
                    elif fragment is not None:
                        call_arguments = _merge_arguments(call_arguments, fragment)

        if call_name:
            arguments = _parse_arguments(call_arguments or "{}")
            yield StreamDelta(
                function_call=_FunctionCall(call_name, arguments),
                assistant_message={
                    "role": "assistant",
                    "content": "".join(text_parts) or None,
                    "function_call": {"name": call_name, "arguments": arguments},
                },
            )

    async def aclose(self) -> None:
        await self._http.aclose()

    def _to_request(self, payload: dict) -> dict:
        request: dict[str, Any] = {
            "model": self._model,
            "messages": _convert_messages(payload.get("messages") or []),
            "temperature": (payload.get("model_options") or {}).get("temperature", 0.1),
        }
        specs = _extract_specs(payload)
        if specs:
            request["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": spec["name"],
                        "description": spec.get("description"),
                        "parameters": spec.get("parameters"),
                    },
                }
                for spec in specs
            ]
            request["tool_choice"] = "auto"
        return request

    @staticmethod
    def _from_response(data: dict) -> _Completion:
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(
                "Ollama/LM Studio вернул ответ без choices[0].message"
            ) from exc

        text = message.get("content") or ""
        parts = [_TextPart(text)] if text else []
        call: _FunctionCall | None = None
        tool_calls = message.get("tool_calls") or []
        if tool_calls:
            # AgentService выполняет один вызов за шаг, поэтому лишние отбрасываем.
            function = tool_calls[0].get("function") or {}
            call = _FunctionCall(
                function.get("name") or "",
                _parse_arguments(function.get("arguments")),
            )
        return _Completion([_Message("assistant", parts, call)])


def _extract_specs(payload: dict) -> list[dict]:
    """Достаёт спецификации инструментов из payload в формате GigaChat."""
    tools = payload.get("tools") or []
    if not tools:
        return []
    return (tools[0].get("functions") or {}).get("specifications") or []


def _convert_messages(messages: list[dict]) -> list[dict]:
    """Переводит историю из формата GigaChat в OpenAI, включая вызовы функций."""
    result: list[dict] = []
    pending_calls: dict[str, list[str]] = {}
    counter = 0

    for message in messages:
        role = message.get("role")

        if role in ("system", "user"):
            result.append({"role": role, "content": _content_text(message.get("content"))})
            continue

        if role == "assistant":
            text = _content_text(message.get("content"))
            call = message.get("function_call")
            if call is None:
                result.append({"role": "assistant", "content": text})
                continue

            counter += 1
            call_id = f"call_{counter}"
            name = call.get("name") or message.get("name") or ""
            arguments = call.get("arguments") or {}
            result.append(
                {
                    "role": "assistant",
                    "content": text or None,
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": _json(arguments),
                            },
                        }
                    ],
                }
            )
            pending_calls.setdefault(name, []).append(call_id)
            continue

        if role in ("tool", "function"):
            name, value = _function_result(message)
            ids = pending_calls.get(name) or []
            if ids:
                call_id = ids.pop(0)
            else:
                counter += 1
                call_id = f"call_{counter}"
            result.append({"role": "tool", "tool_call_id": call_id, "content": _json(value)})

    return result


def _content_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for part in content:
        parts.append(part.get("text", "") if isinstance(part, dict) else str(part))
    return "".join(parts)


def _function_result(message: dict) -> tuple[str, Any]:
    content = message.get("content")
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and "function_result" in part:
                result = part["function_result"] or {}
                return result.get("name") or message.get("name") or "", result.get("result")
    return message.get("name") or "", content


def _json(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, default=str)


def _parse_arguments(raw: Any) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _merge_arguments(current: Any, incoming: Any) -> Any:
    """Склеивает аргументы вызова инструмента, приходящие частями."""
    if incoming is None:
        return current
    if isinstance(current, dict) and isinstance(incoming, dict):
        return {**current, **incoming}
    return incoming


def build_llm_client(model_settings: ModelSettings | None = None) -> LLMClient:
    """Собирает клиент по настройкам пользователя или по LLM_PROVIDER из env."""
    if model_settings is not None and model_settings.provider == "local":
        return OpenAICompatibleClient(
            base_url=model_settings.base_url or settings.llm_base_url,
            api_key=model_settings.api_key or settings.llm_api_key,
            model=model_settings.model or "",
            timeout=settings.llm_timeout,
        )

    if model_settings is None and settings.llm_provider == "openai_compatible":
        if not settings.llm_model:
            raise ValueError("LLM_MODEL обязателен при LLM_PROVIDER=openai_compatible")
        return OpenAICompatibleClient(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout=settings.llm_timeout,
        )

    return GigaChatClient()
