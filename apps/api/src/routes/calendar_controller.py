from fastapi import APIRouter

from deps import CalendarServiceDep, ProfileServiceDep
from schemas.calendar import YandexCalendarStatus, YandexConnectRequest, YandexSyncResult

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/yandex/status", response_model=YandexCalendarStatus)
async def yandex_status(service: CalendarServiceDep) -> YandexCalendarStatus:
    return await service.yandex_status()


@router.post("/yandex/connect", response_model=YandexCalendarStatus)
async def yandex_connect(
    request: YandexConnectRequest, service: CalendarServiceDep
) -> YandexCalendarStatus:
    return await service.connect_yandex(request)


@router.delete("/yandex/disconnect", response_model=YandexCalendarStatus)
async def yandex_disconnect(service: CalendarServiceDep) -> YandexCalendarStatus:
    await service.disconnect_yandex()
    return YandexCalendarStatus(connected=False)


@router.post("/yandex/sync", response_model=YandexSyncResult)
async def yandex_sync(service: ProfileServiceDep) -> YandexSyncResult:
    meetings, reminders, failed = await service.sync_unsynced_items()
    return YandexSyncResult(meetings=meetings, reminders=reminders, failed=failed)
