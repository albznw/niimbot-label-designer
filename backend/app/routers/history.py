from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, func, select

from app.database import get_session
from app.models import PrintJob
from app.schemas import PaginatedPrintJobs, PrintJobResponse

router = APIRouter(prefix="/history", tags=["history"])

SessionDep = Annotated[Session, Depends(get_session)]


def _get_job_or_404(session: Session, job_id: str) -> PrintJob:
    job = session.get(PrintJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Print job not found")
    return job


@router.get("", response_model=PaginatedPrintJobs)
def list_history(
    session: SessionDep, page: int = 1, per_page: int = 20
) -> PaginatedPrintJobs:
    offset = (page - 1) * per_page
    total = session.exec(select(func.count()).select_from(PrintJob)).one()
    jobs = session.exec(
        select(PrintJob)
        .order_by(PrintJob.printed_at.desc())
        .offset(offset)
        .limit(per_page)
    ).all()
    items = [PrintJobResponse.model_validate(job, from_attributes=True) for job in jobs]
    return PaginatedPrintJobs(items=items, total=total, page=page, per_page=per_page)


@router.get("/{job_id}", response_model=PrintJobResponse)
def get_job(job_id: str, session: SessionDep) -> PrintJobResponse:
    job = _get_job_or_404(session, job_id)
    return PrintJobResponse.model_validate(job, from_attributes=True)


@router.get("/{job_id}/bitmap")
def get_bitmap(job_id: str, session: SessionDep) -> FileResponse:
    job = _get_job_or_404(session, job_id)
    if not job.bitmap_path:
        raise HTTPException(status_code=404, detail="No bitmap for this job")
    return FileResponse(job.bitmap_path, media_type="image/png")
