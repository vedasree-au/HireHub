def register(client,email,role):
    r=client.post('/auth/register',json={'name':'Test User','email':email,'password':'StrongPass123','role':role})
    assert r.status_code==201, r.text
    return r.json()['access_token']

def test_candidate_can_apply_once(client):
    recruiter_token=register(client,'recruiter@example.com','recruiter')
    client.headers.update({'Authorization':f'Bearer {recruiter_token}'})
    job=client.post('/jobs',json={'title':'Python Developer','company':'Acme','description':'Build APIs and services with Python and FastAPI.','required_skills':'Python, FastAPI'} )
    assert job.status_code==201,job.text
    job_id=job.json()['id']
    candidate_token=register(client,'candidate@example.com','candidate')
    client.headers.update({'Authorization':f'Bearer {candidate_token}'})
    first=client.post(f'/jobs/{job_id}/apply',json={})
    assert first.status_code==201,first.text
    second=client.post(f'/jobs/{job_id}/apply',json={})
    assert second.status_code==409

def test_candidate_cannot_create_job(client):
    token=register(client,'candidate2@example.com','candidate')
    client.headers.update({'Authorization':f'Bearer {token}'})
    r=client.post('/jobs',json={'title':'Developer','company':'Acme','description':'A long enough job description for this test.'})
    assert r.status_code==403

def test_candidate_application_details_and_public_stats(client):
    recruiter_token=register(client,'details-recruiter@example.com','recruiter')
    client.headers.update({'Authorization':f'Bearer {recruiter_token}'})
    job=client.post('/jobs',json={
        'title':'Platform Engineer',
        'company':'Northstar',
        'description':'Build and maintain reliable cloud platform services.',
    })
    assert job.status_code==201,job.text

    candidate_token=register(client,'details-candidate@example.com','candidate')
    client.headers.update({'Authorization':f'Bearer {candidate_token}'})
    application=client.post(f"/jobs/{job.json()['id']}/apply",json={})
    assert application.status_code==201,application.text

    details=client.get('/applications/me/details')
    assert details.status_code==200,details.text
    assert details.json()[0]['job']=={
        'id':job.json()['id'],
        'title':'Platform Engineer',
        'company':'Northstar',
        'location':'Not specified',
    }
    assert details.json()[0]['resume'] is None

    stats=client.get('/public/stats')
    assert stats.status_code==200,stats.text
    assert stats.json()=={'published_jobs':1,'candidates':1,'recruiters':1}
