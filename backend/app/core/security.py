from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
ALGORITHM = 'HS256'
def hash_password(password: str) -> str: return pwd.hash(password)
def verify_password(password: str, hashed: str) -> bool: return pwd.verify(password, hashed)
def create_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({'sub': str(user_id), 'role': role, 'exp': exp}, settings.secret_key, algorithm=ALGORITHM)
def decode_token(token: str):
    try: return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError: return None
