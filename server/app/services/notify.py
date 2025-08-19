import httpx
from ..config import settings
from ..utils.logging import get_logger

log = get_logger(__name__)

async def notify_telegram(msg: str):
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID): return
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as c:
        await c.post(url, json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": msg})

async def notify_discord(msg: str):
    if not settings.DISCORD_WEBHOOK_URL: return
    async with httpx.AsyncClient(timeout=15) as c:
        await c.post(settings.DISCORD_WEBHOOK_URL, json={"content": msg})

async def announce(msg: str):
    await notify_telegram(msg)
    await notify_discord(msg)
