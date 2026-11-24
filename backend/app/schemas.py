from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: str = 'candidate'
class LoginIn(BaseModel): email: EmailStr; password: str
class UserOut(BaseModel):
    id: int; name: str; email: EmailStr; role: str; is_active: bool
    model_config = ConfigDict(from_attributes=True)
class TokenOut(BaseModel): access_token: str; token_type: str = 'bearer'; user: UserOut
class ProfileIn(BaseModel):
    phone: str = ''; location: str = ''; summary: str = ''; skills: str = ''; education: str = ''; experience: str = ''
    linkedin_url: str = ''; portfolio_url: str = ''; github_url: str = ''
class RecruiterProfileIn(BaseModel): company_name: str = ''; website: str = ''; description: str = ''
class JobIn(BaseModel):
    title: str = Field(min_length=2, max_length=180); company: str = Field(min_length=2, max_length=180); description: str = Field(min_length=20)
    location: str = 'Not specified'; employment_type: str = 'Full-time'; workplace_type: str = 'Onsite'
    required_skills: str = ''; preferred_skills: str = ''; min_experience: int = Field(default=0, ge=0)
    max_experience: int = Field(default=0, ge=0); salary_min: int | None = Field(default=None, ge=0); salary_max: int | None = Field(default=None, ge=0)
    openings: int = Field(default=1, ge=1); deadline: datetime | None = None; status: str = 'published'
class JobOut(JobIn):
    id: int; recruiter_id: int; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class ApplicationIn(BaseModel): cover_letter: str = ''; resume_id: int | None = None
class ApplicationOut(BaseModel):
    id: int; candidate_id: int; job_id: int; resume_id: int | None; status: str; cover_letter: str; created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class StatusIn(BaseModel): status: str
class NoteIn(BaseModel): note: str = Field(min_length=1, max_length=5000)
class MatchIn(BaseModel): resume_text: str = Field(min_length=10); job_description: str = Field(min_length=10)
