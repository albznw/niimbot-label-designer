from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Template
from app.schemas import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])

SessionDep = Annotated[Session, Depends(get_session)]


def _get_template_or_404(session: Session, template_id: str) -> Template:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=list[TemplateResponse])
def list_templates(session: SessionDep) -> list[Template]:
    return list(session.exec(select(Template)).all())


@router.post("", response_model=TemplateResponse, status_code=201)
def create_template(body: TemplateCreate, session: SessionDep) -> Template:
    template = Template(
        name=body.name,
        mode=body.mode,
        label_size=body.label_size,
        sub_label=body.sub_label,
        variables=body.variables or "[]",
        canvas_json=body.canvas_json,
        html=body.html,
    )
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str, body: TemplateUpdate, session: SessionDep
) -> Template:
    template = _get_template_or_404(session, template_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(template, field, value)
    template.updated_at = datetime.utcnow()
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: str, session: SessionDep) -> None:
    template = _get_template_or_404(session, template_id)
    session.delete(template)
    session.commit()
