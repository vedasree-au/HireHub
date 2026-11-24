"""Explainable, advisory resume-to-job text matching.

Sentence Transformers is used when installed and its model is available. A TF-IDF
fallback keeps local development usable when the model cannot be downloaded.
Neither score is a hiring probability or an automated decision.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

_model = None
_model_checked = False

def _tokens(text: str) -> set[str]:
    return {x.lower() for x in re.findall(r'[A-Za-z][A-Za-z+#.]{1,}', text)}

def _similarity(resume_text: str, job_description: str) -> tuple[float, str]:
    global _model, _model_checked
    if not _model_checked:
        _model_checked = True
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception:
            _model = None
    if _model is not None:
        vectors = _model.encode([resume_text, job_description], normalize_embeddings=True)
        score = float((vectors[0] @ vectors[1]) * 100)
        return round(max(0.0, min(100.0, score)), 2), 'Sentence Transformers all-MiniLM-L6-v2 semantic cosine similarity'
    try:
        vectorizer=TfidfVectorizer(stop_words='english', ngram_range=(1,2))
        matrix=vectorizer.fit_transform([resume_text,job_description])
        score=round(float(cosine_similarity(matrix[0:1],matrix[1:2])[0][0])*100,2)
    except ValueError:
        score=0.0
    return score, 'TF-IDF lexical cosine similarity fallback'

def match_resume(resume_text: str, job_description: str):
    score, method = _similarity(resume_text, job_description)
    resume=_tokens(resume_text); job=_tokens(job_description)
    overlap=sorted(resume & job); missing=sorted(job-resume)
    return {
        'score':score,
        'similarity_score':score,
        'method':method,
        'matching_keywords':overlap[:30],
        'missing_keywords':missing[:30],
        'job_keywords_not_found_in_resume':missing[:30],
        'explanation':f'The resume and job description share {len(overlap)} detected terms. {len(missing)} terms from the job description were not detected in the resume text.',
        'notice':'Advisory text similarity only. This is not a hiring probability, validated qualification score, or automated selection/rejection decision. A human must review every application.'
    }
