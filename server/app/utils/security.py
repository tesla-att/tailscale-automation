from cryptography.fernet import Fernet
from .logging import get_logger
from ..config import settings

fernet = Fernet(settings.ENCRYPTION_KEY.encode())
log = get_logger(__name__)

def encrypt_plain(s: str) -> str:
    return fernet.encrypt(s.encode()).decode()

def decrypt_cipher(s: str) -> str:
    return fernet.decrypt(s.encode()).decode()

def mask_key(k: str, last: int = 6) -> str:
    return ("*" * max(0, len(k)-last)) + k[-last:]
