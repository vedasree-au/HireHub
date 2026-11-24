from app.services.matching import match_resume

def test_match_returns_advisory_score():
    result=match_resume('Python developer with FastAPI and SQL experience','Python FastAPI developer needed')
    assert 0 <= result['similarity_score'] <= 100
    assert 'notice' in result
