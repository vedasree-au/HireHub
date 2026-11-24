from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, UniqueConstraint, Boolean, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default='candidate', index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CandidateProfile(Base):
    __tablename__ = 'candidate_profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(30), default='')
    location: Mapped[str] = mapped_column(String(180), default='')
    summary: Mapped[str] = mapped_column(Text, default='')
    skills: Mapped[str] = mapped_column(Text, default='')
    education: Mapped[str] = mapped_column(Text, default='')
    experience: Mapped[str] = mapped_column(Text, default='')
    linkedin_url: Mapped[str] = mapped_column(String(500), default='')
    portfolio_url: Mapped[str] = mapped_column(String(500), default='')
    github_url: Mapped[str] = mapped_column(String(500), default='')
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RecruiterProfile(Base):
    __tablename__ = 'recruiter_profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(180), default='')
    website: Mapped[str] = mapped_column(String(500), default='')
    description: Mapped[str] = mapped_column(Text, default='')

class Job(Base):
    __tablename__ = 'jobs'
    id: Mapped[int] = mapped_column(primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    company: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(180), default='Not specified')
    employment_type: Mapped[str] = mapped_column(String(50), default='Full-time')
    workplace_type: Mapped[str] = mapped_column(String(30), default='Onsite')
    required_skills: Mapped[str] = mapped_column(Text, default='')
    preferred_skills: Mapped[str] = mapped_column(Text, default='')
    min_experience: Mapped[int] = mapped_column(Integer, default=0)
    max_experience: Mapped[int] = mapped_column(Integer, default=0)
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    openings: Mapped[int] = mapped_column(Integer, default=1)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='published', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

class Resume(Base):
    __tablename__ = 'resumes'
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255), unique=True)
    extracted_text: Mapped[str] = mapped_column(Text, default='')
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Application(Base):
    __tablename__ = 'applications'
    __table_args__ = (UniqueConstraint('candidate_id', 'job_id', name='uq_candidate_job'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id', ondelete='CASCADE'), index=True)
    resume_id: Mapped[int | None] = mapped_column(ForeignKey('resumes.id', ondelete='SET NULL'), nullable=True)
    cover_letter: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(String(40), default='Applied', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SavedJob(Base):
    __tablename__ = 'saved_jobs'
    __table_args__ = (UniqueConstraint('candidate_id', 'job_id', name='uq_saved_candidate_job'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id', ondelete='CASCADE'), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ApplicationNote(Base):
    __tablename__ = 'application_notes'
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey('applications.id', ondelete='CASCADE'), index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = 'notifications'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    message: Mapped[str] = mapped_column(String(500))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ResumeMatchResult(Base):
    __tablename__ = 'resume_match_results'
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id', ondelete='CASCADE'), index=True)
    score: Mapped[float] = mapped_column(Float)
    matching_skills: Mapped[str] = mapped_column(Text, default='')
    missing_skills: Mapped[str] = mapped_column(Text, default='')
    explanation: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class JobReport(Base):
    __tablename__ = 'job_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id', ondelete='CASCADE'), index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='open')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
