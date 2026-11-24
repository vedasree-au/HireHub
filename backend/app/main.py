from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pathlib import Path
from datetime import datetime
from uuid import uuid4
import os, re
from pypdf import PdfReader
from docx import Document
from app.core.db import Base, engine, get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_token
from app.models import User, Job, Application, CandidateProfile, RecruiterProfile, Resume, SavedJob, ApplicationNote, Notification, ResumeMatchResult, JobReport
from app.schemas import RegisterIn, LoginIn, TokenOut, UserOut, JobIn, JobOut, ApplicationOut, StatusIn, MatchIn, ProfileIn, RecruiterProfileIn, ApplicationIn, NoteIn
from app.deps import current_user, require_role
from app.services.matching import match_resume

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app = FastAPI(title='HireHub API', version='2.0.0', description='Job Portal & Recruitment Management System')
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(',')], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

@app.on_event('startup')
def seed_admin():
    if settings.admin_email and settings.admin_password:
        db = next(get_db())
        try:
            email = settings.admin_email.lower()
            if not db.query(User).filter(User.email == email).first():
                db.add(User(name='HireHub Administrator', email=email, password_hash=hash_password(settings.admin_password), role='admin'))
                db.commit()
        finally: db.close()

@app.get('/health')
def health(): return {'status':'ok', 'database':'configured'}

@app.get('/public/stats')
def public_stats(db: Session = Depends(get_db)):
    return {
        'published_jobs': db.query(Job).filter_by(status='published').count(),
        'candidates': db.query(User).filter_by(role='candidate', is_active=True).count(),
        'recruiters': db.query(User).filter_by(role='recruiter', is_active=True).count(),
    }

@app.post('/auth/register', response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if payload.role not in ('candidate','recruiter'): raise HTTPException(400, 'Role must be candidate or recruiter')
    if db.query(User).filter(User.email == payload.email.lower()).first(): raise HTTPException(409, 'Email already registered')
    user = User(name=payload.name.strip(), email=payload.email.lower(), password_hash=hash_password(payload.password), role=payload.role)
    db.add(user); db.flush()
    if user.role == 'candidate': db.add(CandidateProfile(user_id=user.id))
    else: db.add(RecruiterProfile(user_id=user.id))
    db.commit(); db.refresh(user)
    return {'access_token':create_token(user.id,user.role),'user':user}

@app.post('/auth/login', response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(401, 'Incorrect email or password')
    if not user.is_active: raise HTTPException(403, 'Account is disabled')
    return {'access_token':create_token(user.id,user.role),'user':user}

@app.get('/auth/me', response_model=UserOut)
def me(user: User = Depends(current_user)): return user

@app.get('/candidate/profile')
def get_candidate_profile(user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    return db.query(CandidateProfile).filter_by(user_id=user.id).first()
@app.put('/candidate/profile')
def update_candidate_profile(payload: ProfileIn, user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    p=db.query(CandidateProfile).filter_by(user_id=user.id).first()
    if not p: p=CandidateProfile(user_id=user.id); db.add(p)
    for k,v in payload.model_dump().items(): setattr(p,k,v)
    db.commit(); db.refresh(p); return p
@app.get('/recruiter/profile')
def get_recruiter_profile(user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    return db.query(RecruiterProfile).filter_by(user_id=user.id).first()
@app.put('/recruiter/profile')
def update_recruiter_profile(payload: RecruiterProfileIn, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    p=db.query(RecruiterProfile).filter_by(user_id=user.id).first()
    if not p: p=RecruiterProfile(user_id=user.id); db.add(p)
    for k,v in payload.model_dump().items(): setattr(p,k,v)
    db.commit(); db.refresh(p); return p

@app.get('/jobs', response_model=list[JobOut])
def list_jobs(q: str | None = None, location: str | None = None, skills: str | None = None, employment_type: str | None = None, workplace_type: str | None = None, min_experience: int | None = None, max_salary: int | None = None, sort: str = 'newest', skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    query = db.query(Job).filter(Job.status == 'published')
    if q: query = query.filter(or_(Job.title.ilike(f'%{q}%'), Job.description.ilike(f'%{q}%'), Job.company.ilike(f'%{q}%'), Job.required_skills.ilike(f'%{q}%')))
    if location: query = query.filter(Job.location.ilike(f'%{location}%'))
    if skills: query = query.filter(Job.required_skills.ilike(f'%{skills}%'))
    if employment_type: query = query.filter(Job.employment_type == employment_type)
    if workplace_type: query = query.filter(Job.workplace_type == workplace_type)
    if min_experience is not None: query = query.filter(Job.max_experience >= min_experience)
    if max_salary is not None: query = query.filter(or_(Job.salary_max == None, Job.salary_max <= max_salary))
    query = query.order_by(Job.created_at.asc() if sort == 'oldest' else Job.created_at.desc())
    return query.offset(skip).limit(limit).all()
@app.get('/jobs/{job_id}', response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != 'published': raise HTTPException(404, 'Job not found')
    return job
@app.post('/jobs', response_model=JobOut, status_code=201)
def create_job(payload: JobIn, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    if payload.max_experience and payload.max_experience < payload.min_experience: raise HTTPException(400,'Maximum experience must be greater than minimum experience')
    if payload.status not in ('published','draft'): raise HTTPException(400,'New jobs can only be published or saved as draft')
    if payload.salary_min is not None and payload.salary_max is not None and payload.salary_max < payload.salary_min: raise HTTPException(400,'Maximum salary must not be below minimum salary')
    data=payload.model_dump(); job = Job(**data, recruiter_id=user.id); db.add(job); db.commit(); db.refresh(job); return job
@app.put('/jobs/{job_id}', response_model=JobOut)
def update_job(job_id: int, payload: JobIn, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.recruiter_id != user.id: raise HTTPException(404, 'Job not found')
    if payload.status not in ('published','draft','closed'): raise HTTPException(400,'Invalid job status')
    if payload.max_experience and payload.max_experience < payload.min_experience: raise HTTPException(400,'Maximum experience must be greater than minimum experience')
    for key,value in payload.model_dump().items(): setattr(job,key,value)
    db.commit(); db.refresh(job); return job
@app.delete('/jobs/{job_id}')
def close_job(job_id: int, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.recruiter_id != user.id: raise HTTPException(404, 'Job not found')
    job.status='closed'; db.commit(); return {'message':'Job closed'}
@app.get('/recruiter/jobs', response_model=list[JobOut])
def recruiter_jobs(user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    return db.query(Job).filter_by(recruiter_id=user.id).order_by(Job.created_at.desc()).all()

@app.post('/resumes', status_code=201)
async def upload_resume(file: UploadFile = File(...), user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    ext=Path(file.filename or '').suffix.lower()
    if ext not in ('.pdf','.docx'): raise HTTPException(400,'Only PDF and DOCX resumes are allowed')
    content=await file.read()
    if len(content)>5*1024*1024: raise HTTPException(413,'Resume must be 5 MB or smaller')
    if ext=='.pdf' and not content.startswith(b'%PDF'): raise HTTPException(400,'Invalid PDF file')
    if ext=='.docx' and not content.startswith(b'PK'): raise HTTPException(400,'Invalid DOCX file')
    stored=f'{uuid4().hex}{ext}'; path=Path(settings.upload_dir)/stored; path.write_bytes(content)
    try:
        if ext=='.pdf':
            import io
            text='\n'.join((p.extract_text() or '') for p in PdfReader(io.BytesIO(content)).pages)
        else:
            import io
            from docx import Document
            text='\n'.join(p.text for p in Document(io.BytesIO(content)).paragraphs)
    except Exception:
        path.unlink(missing_ok=True); raise HTTPException(400,'Could not read resume contents')
    if not text.strip(): path.unlink(missing_ok=True); raise HTTPException(400,'No readable text found in resume')
    db.query(Resume).filter_by(candidate_id=user.id).update({'is_default':False})
    r=Resume(candidate_id=user.id,original_filename=Path(file.filename or 'resume').name,stored_filename=stored,extracted_text=text,is_default=True)
    db.add(r); db.commit(); db.refresh(r)
    return {'id':r.id,'filename':r.original_filename,'is_default':r.is_default,'created_at':r.created_at}
@app.get('/resumes')
def list_resumes(user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    return [{'id':r.id,'filename':r.original_filename,'is_default':r.is_default,'created_at':r.created_at} for r in db.query(Resume).filter_by(candidate_id=user.id).order_by(Resume.created_at.desc()).all()]
@app.get('/resumes/{resume_id}/download')
def download_resume(resume_id:int,user:User=Depends(current_user),db:Session=Depends(get_db)):
    r=db.get(Resume,resume_id)
    if not r: raise HTTPException(404,'Resume not found')
    if user.role=='candidate' and r.candidate_id!=user.id: raise HTTPException(403,'Not your resume')
    if user.role=='recruiter':
        allowed=db.query(Application).join(Job,Application.job_id==Job.id).filter(Application.resume_id==r.id,Job.recruiter_id==user.id).first()
        if not allowed: raise HTTPException(403,'Resume is not attached to an application for your job')
    elif user.role!='admin' and user.role!='candidate': raise HTTPException(403,'Access denied')
    path=Path(settings.upload_dir)/r.stored_filename
    if not path.exists(): raise HTTPException(404,'Resume file is missing')
    return FileResponse(path,filename=r.original_filename,media_type='application/octet-stream')

@app.get('/recommendations/jobs',response_model=list[JobOut])
def recommended_jobs(user:User=Depends(require_role('candidate')),db:Session=Depends(get_db)):
    profile=db.query(CandidateProfile).filter_by(user_id=user.id).first()
    if not profile or not (profile.skills or profile.summary): return db.query(Job).filter_by(status='published').order_by(Job.created_at.desc()).limit(10).all()
    terms=[x.strip().lower() for x in re.split(r'[,;\n]',profile.skills or '') if x.strip()]
    q=db.query(Job).filter(Job.status=='published')
    if terms:
        q=q.filter(or_(*[Job.required_skills.ilike(f'%{term}%') for term in terms]))
    return q.order_by(Job.created_at.desc()).limit(10).all()

@app.delete('/resumes/{resume_id}')
def delete_resume(resume_id: int, user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    r=db.get(Resume,resume_id)
    if not r or r.candidate_id!=user.id: raise HTTPException(404,'Resume not found')
    (Path(settings.upload_dir)/r.stored_filename).unlink(missing_ok=True); db.delete(r); db.commit(); return {'message':'Resume deleted'}

@app.post('/jobs/{job_id}/apply', response_model=ApplicationOut, status_code=201)
def apply(job_id: int, payload: ApplicationIn = ApplicationIn(), user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    job=db.get(Job,job_id)
    if not job or job.status!='published': raise HTTPException(404,'Job not found or closed')
    if db.query(Application).filter_by(candidate_id=user.id,job_id=job_id).first(): raise HTTPException(409,'Already applied')
    resume_id=payload.resume_id
    if resume_id:
        resume=db.get(Resume,resume_id)
        if not resume or resume.candidate_id!=user.id: raise HTTPException(404,'Resume not found')
    else:
        default_resume=db.query(Resume).filter_by(candidate_id=user.id,is_default=True).first()
        resume_id=default_resume.id if default_resume else None
    application=Application(candidate_id=user.id,job_id=job_id,resume_id=resume_id,cover_letter=payload.cover_letter)
    db.add(application); db.flush(); db.add(Notification(user_id=job.recruiter_id,message=f'New application received for {job.title}'))
    db.commit(); db.refresh(application); return application
@app.get('/applications/me', response_model=list[ApplicationOut])
def my_applications(user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    return db.query(Application).filter_by(candidate_id=user.id).order_by(Application.created_at.desc()).all()
@app.get('/applications/me/details')
def my_application_details(user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    rows = db.query(Application, Job, Resume).join(
        Job, Application.job_id == Job.id
    ).outerjoin(
        Resume, Application.resume_id == Resume.id
    ).filter(
        Application.candidate_id == user.id
    ).order_by(Application.created_at.desc()).all()
    return [{
        'id': application.id,
        'status': application.status,
        'created_at': application.created_at,
        'job': {
            'id': job.id,
            'title': job.title,
            'company': job.company,
            'location': job.location,
        },
        'resume': {
            'id': resume.id,
            'filename': resume.original_filename,
        } if resume else None,
    } for application, job, resume in rows]
@app.post('/jobs/{job_id}/save')
def save_job(job_id: int, user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    if not db.get(Job,job_id): raise HTTPException(404,'Job not found')
    if not db.query(SavedJob).filter_by(candidate_id=user.id,job_id=job_id).first(): db.add(SavedJob(candidate_id=user.id,job_id=job_id)); db.commit()
    return {'message':'Job saved'}
@app.delete('/jobs/{job_id}/save')
def unsave_job(job_id: int, user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    row=db.query(SavedJob).filter_by(candidate_id=user.id,job_id=job_id).first()
    if row: db.delete(row); db.commit()
    return {'message':'Job removed from saved jobs'}
@app.get('/saved-jobs', response_model=list[JobOut])
def saved_jobs(user: User = Depends(require_role('candidate')), db: Session = Depends(get_db)):
    return db.query(Job).join(SavedJob,SavedJob.job_id==Job.id).filter(SavedJob.candidate_id==user.id).all()

@app.get('/recruiter/applications')
def recruiter_applications(status: str | None = None, job_id: int | None = None, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    q=db.query(Application,Job,User).join(Job,Application.job_id==Job.id).join(User,Application.candidate_id==User.id).filter(Job.recruiter_id==user.id)
    if status: q=q.filter(Application.status==status)
    if job_id: q=q.filter(Job.id==job_id)
    return [{'application':a,'job':{'id':j.id,'title':j.title},'candidate':{'id':c.id,'name':c.name,'email':c.email}} for a,j,c in q.order_by(Application.created_at.desc()).all()]
@app.patch('/applications/{application_id}/status', response_model=ApplicationOut)
def update_application_status(application_id: int, payload: StatusIn, user: User = Depends(require_role('recruiter')), db: Session = Depends(get_db)):
    allowed={'Under Review','Shortlisted','Interview Scheduled','Selected','Rejected'}
    if payload.status not in allowed: raise HTTPException(400,'Invalid status')
    application=db.get(Application,application_id)
    if not application: raise HTTPException(404,'Application not found')
    job=db.get(Job,application.job_id)
    if job.recruiter_id != user.id: raise HTTPException(403,'Not your application')
    application.status=payload.status; db.add(Notification(user_id=application.candidate_id,message=f'Your application for {job.title} is now {payload.status}'))
    db.commit(); db.refresh(application); return application
@app.get('/applications/{application_id}/resume-match')
def recruiter_resume_match(application_id:int,user:User=Depends(require_role('recruiter')),db:Session=Depends(get_db)):
    a=db.get(Application,application_id)
    if not a: raise HTTPException(404,'Application not found')
    job=db.get(Job,a.job_id)
    if job.recruiter_id!=user.id: raise HTTPException(403,'Not your application')
    if not a.resume_id: raise HTTPException(404,'Candidate did not attach a resume')
    r=db.get(Resume,a.resume_id)
    if not r: raise HTTPException(404,'Resume not found')
    return match_resume(r.extracted_text,job.description+' '+job.required_skills)

@app.post('/applications/{application_id}/notes')
def add_application_note(application_id: int,payload: NoteIn,user: User=Depends(require_role('recruiter')),db: Session=Depends(get_db)):
    a=db.get(Application,application_id)
    if not a: raise HTTPException(404,'Application not found')
    job=db.get(Job,a.job_id)
    if job.recruiter_id!=user.id: raise HTTPException(403,'Not your application')
    n=ApplicationNote(application_id=a.id,recruiter_id=user.id,note=payload.note); db.add(n); db.commit(); db.refresh(n); return n
@app.get('/applications/{application_id}/notes')
def get_application_notes(application_id: int,user: User=Depends(require_role('recruiter')),db: Session=Depends(get_db)):
    a=db.get(Application,application_id)
    if not a: raise HTTPException(404,'Application not found')
    if db.get(Job,a.job_id).recruiter_id!=user.id: raise HTTPException(403,'Not your application')
    return db.query(ApplicationNote).filter_by(application_id=application_id).all()
@app.post('/applications/{application_id}/withdraw',response_model=ApplicationOut)
def withdraw_application(application_id:int,user:User=Depends(require_role('candidate')),db:Session=Depends(get_db)):
    a=db.get(Application,application_id)
    if not a or a.candidate_id!=user.id: raise HTTPException(404,'Application not found')
    if a.status in ('Selected','Rejected'): raise HTTPException(400,'This application can no longer be withdrawn')
    a.status='Withdrawn'; db.commit(); db.refresh(a); return a

@app.get('/notifications')
def notifications(user:User=Depends(current_user),db:Session=Depends(get_db)):
    return db.query(Notification).filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(100).all()
@app.patch('/notifications/{notification_id}/read')
def read_notification(notification_id:int,user:User=Depends(current_user),db:Session=Depends(get_db)):
    n=db.get(Notification,notification_id)
    if not n or n.user_id!=user.id: raise HTTPException(404,'Notification not found')
    n.is_read=True; db.commit(); return {'message':'Marked as read'}

@app.post('/ai/match-resume')
def ai_match(payload: MatchIn, user: User = Depends(current_user)):
    return match_resume(payload.resume_text, payload.job_description)
@app.post('/ai/match-job/{job_id}')
def match_saved_resume(job_id:int,user:User=Depends(require_role('candidate')),db:Session=Depends(get_db)):
    job=db.get(Job,job_id)
    resume=db.query(Resume).filter_by(candidate_id=user.id,is_default=True).first()
    if not job or not resume: raise HTTPException(404,'Job or default resume not found')
    result=match_resume(resume.extracted_text,job.description+' '+job.required_skills)
    saved=ResumeMatchResult(candidate_id=user.id,job_id=job.id,score=result['score'],matching_skills=', '.join(result['matching_keywords']),missing_skills=', '.join(result['missing_keywords']),explanation=result['explanation'])
    db.add(saved); db.commit()
    return result

@app.get('/recruiter/dashboard')
def recruiter_dashboard(user:User=Depends(require_role('recruiter')),db:Session=Depends(get_db)):
    jobs=db.query(Job).filter_by(recruiter_id=user.id).all(); ids=[j.id for j in jobs]
    apps=db.query(Application).filter(Application.job_id.in_(ids)).all() if ids else []
    return {'total_jobs':len(jobs),'active_jobs':sum(j.status=='published' for j in jobs),'total_applications':len(apps),'under_review':sum(a.status=='Under Review' for a in apps),'shortlisted':sum(a.status=='Shortlisted' for a in apps),'rejected':sum(a.status=='Rejected' for a in apps)}
@app.get('/candidate/dashboard')
def candidate_dashboard(user:User=Depends(require_role('candidate')),db:Session=Depends(get_db)):
    apps=db.query(Application).filter_by(candidate_id=user.id).all(); saved=db.query(SavedJob).filter_by(candidate_id=user.id).count(); resumes=db.query(Resume).filter_by(candidate_id=user.id).count()
    return {'applications':len(apps),'saved_jobs':saved,'resumes':resumes,'statuses':{s:sum(a.status==s for a in apps) for s in ['Applied','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected','Withdrawn']}}

@app.post('/jobs/{job_id}/report',status_code=201)
def report_job(job_id:int,reason:str=Query(min_length=5,max_length=2000),user:User=Depends(current_user),db:Session=Depends(get_db)):
    if not db.get(Job,job_id): raise HTTPException(404,'Job not found')
    report=JobReport(job_id=job_id,reporter_id=user.id,reason=reason); db.add(report); db.commit(); db.refresh(report)
    return {'id':report.id,'status':report.status,'message':'Report submitted for administrator review'}

@app.get('/admin/dashboard')
def admin_dashboard(user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    return {'users':db.query(User).count(),'candidates':db.query(User).filter_by(role='candidate').count(),'recruiters':db.query(User).filter_by(role='recruiter').count(),'jobs':db.query(Job).count(),'applications':db.query(Application).count()}
@app.get('/admin/users')
def admin_users(skip:int=0,limit:int=50,user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    return [{'id':u.id,'name':u.name,'email':u.email,'role':u.role,'is_active':u.is_active,'created_at':u.created_at} for u in db.query(User).order_by(User.created_at.desc()).offset(skip).limit(min(limit,100)).all()]
@app.patch('/admin/users/{user_id}/status')
def admin_user_status(user_id:int,active:bool,user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    target=db.get(User,user_id)
    if not target: raise HTTPException(404,'User not found')
    if target.id==user.id: raise HTTPException(400,'You cannot disable your own account')
    target.is_active=active; db.commit(); return {'message':'User status updated','is_active':target.is_active}
@app.get('/admin/reports')
def admin_reports(user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    rows=db.query(JobReport).order_by(JobReport.created_at.desc()).all()
    return [{'id':r.id,'job_id':r.job_id,'reporter_id':r.reporter_id,'reason':r.reason,'status':r.status,'created_at':r.created_at} for r in rows]
@app.patch('/admin/reports/{report_id}')
def resolve_report(report_id:int,status:str=Query(pattern='^(open|resolved|dismissed)$'),user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    r=db.get(JobReport,report_id)
    if not r: raise HTTPException(404,'Report not found')
    r.status=status; db.commit(); return {'message':'Report updated','status':status}

@app.get('/admin/jobs')
def admin_jobs(user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    return db.query(Job).order_by(Job.created_at.desc()).limit(200).all()
@app.patch('/admin/jobs/{job_id}/status')
def admin_job_status(job_id:int,status:str,user:User=Depends(require_role('admin')),db:Session=Depends(get_db)):
    if status not in ('published','closed','draft','flagged'): raise HTTPException(400,'Invalid job status')
    job=db.get(Job,job_id)
    if not job: raise HTTPException(404,'Job not found')
    job.status=status; db.commit(); return {'message':'Job status updated'}
