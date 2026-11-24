from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import decode_token
from app.models import User
bearer = HTTPBearer(auto_error=False)
def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if not creds: raise HTTPException(401, 'Authentication required')
    data = decode_token(creds.credentials)
    if not data: raise HTTPException(401, 'Invalid or expired token')
    user = db.get(User, int(data['sub']))
    if not user: raise HTTPException(401, 'User not found')
    if not user.is_active: raise HTTPException(403, 'Account is disabled')
    return user
def require_role(*roles):
    def check(user: User = Depends(current_user)):
        if user.role not in roles: raise HTTPException(403, 'Insufficient permissions')
        return user
    return check
