from fastapi import APIRouter, Query

from deps import CalendarCallbackServiceDep, CalendarServiceDep, ProfileServiceDep
from schemas.calendar import YandexAuthorizeResponse, YandexCalendarStatus, YandexSyncResult

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/yandex/authorize", response_model=YandexAuthorizeResponse)
async def yandex_authorize(service: CalendarServiceDep) -> YandexAuthorizeResponse:
    """Возвращает URL окна Яндекс OAuth. Откройте его в браузере / popup."""
    return await service.yandex_authorize()


@router.get("/yandex/callback")
async def yandex_callback(
    service: CalendarCallbackServiceDep,
    code: str | None = Query(None),
    state: str | None = Query(None),
):
    """Redirect URI для Яндекс OAuth (без JWT — user_id берётся из state)."""
    return await service.yandex_callback(code, state)


@router.get("/yandex/status", response_model=YandexCalendarStatus)
async def yandex_status(service: CalendarServiceDep) -> YandexCalendarStatus:
    return await service.yandex_status()


@router.delete("/yandex/disconnect", response_model=YandexCalendarStatus)
async def yandex_disconnect(service: CalendarServiceDep) -> YandexCalendarStatus:
    await service.disconnect_yandex()
    return YandexCalendarStatus(connected=False)


@router.post("/yandex/sync", response_model=YandexSyncResult)
async def yandex_sync(service: ProfileServiceDep) -> YandexSyncResult:
    meetings, reminders, failed = await service.sync_unsynced_items()
    return YandexSyncResult(meetings=meetings, reminders=reminders, failed=failed)
