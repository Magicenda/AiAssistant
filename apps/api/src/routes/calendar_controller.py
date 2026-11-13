from fastapi import APIRouter, Query

from deps import CalendarCallbackServiceDep, CalendarServiceDep, ProfileServiceDep
from schemas.calendar import (
    AppleCalendarConnectRequest,
    AppleCalendarStatus,
    AppleSyncResult,
    YandexAuthorizeResponse,
    YandexCalendarStatus,
    YandexSyncResult,
)

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
    meetings, reminders, failed = await service.sync_unsynced_items("yandex")
    return YandexSyncResult(meetings=meetings, reminders=reminders, failed=failed)


@router.post("/apple/connect", response_model=AppleCalendarStatus)
async def apple_connect(
    body: AppleCalendarConnectRequest, service: CalendarServiceDep
) -> AppleCalendarStatus:
    """Подключает iCloud Календарь по Apple ID и паролю приложения."""
    return await service.apple_connect(body)


@router.get("/apple/status", response_model=AppleCalendarStatus)
async def apple_status(service: CalendarServiceDep) -> AppleCalendarStatus:
    return await service.apple_status()


@router.delete("/apple/disconnect", response_model=AppleCalendarStatus)
async def apple_disconnect(service: CalendarServiceDep) -> AppleCalendarStatus:
    await service.disconnect_apple()
    return AppleCalendarStatus(connected=False)


@router.post("/apple/sync", response_model=AppleSyncResult)
async def apple_sync(service: ProfileServiceDep) -> AppleSyncResult:
    meetings, reminders, failed = await service.sync_unsynced_items("apple")
    return AppleSyncResult(meetings=meetings, reminders=reminders, failed=failed)
