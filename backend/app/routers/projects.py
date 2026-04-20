from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Project, Template
from app.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])

SessionDep = Annotated[Session, Depends(get_session)]


def _get_project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_template_or_404(
    session: Session, project_id: str, template_id: str
) -> Template:
    template = session.get(Template, template_id)
    if not template or template.project_id != project_id:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=list[ProjectResponse])
def list_projects(session: SessionDep) -> list[Project]:
    return list(session.exec(select(Project)).all())


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(body: ProjectCreate, session: SessionDep) -> Project:
    project = Project(name=body.name)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str, body: ProjectUpdate, session: SessionDep
) -> Project:
    project = _get_project_or_404(session, project_id)
    project.name = body.name
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, session: SessionDep) -> None:
    project = _get_project_or_404(session, project_id)
    templates = session.exec(
        select(Template).where(Template.project_id == project_id)
    ).all()
    for template in templates:
        session.delete(template)
    session.delete(project)
    session.commit()


@router.get("/{project_id}/templates", response_model=list[TemplateResponse])
def list_templates(project_id: str, session: SessionDep) -> list[Template]:
    _get_project_or_404(session, project_id)
    return list(
        session.exec(select(Template).where(Template.project_id == project_id)).all()
    )


@router.post(
    "/{project_id}/templates", response_model=TemplateResponse, status_code=201
)
def create_template(
    project_id: str, body: TemplateCreate, session: SessionDep
) -> Template:
    _get_project_or_404(session, project_id)
    template = Template(
        project_id=project_id,
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


@router.put("/{project_id}/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    project_id: str, template_id: str, body: TemplateUpdate, session: SessionDep
) -> Template:
    template = _get_template_or_404(session, project_id, template_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(template, field, value)
    template.updated_at = datetime.utcnow()
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


@router.delete("/{project_id}/templates/{template_id}", status_code=204)
def delete_template(project_id: str, template_id: str, session: SessionDep) -> None:
    template = _get_template_or_404(session, project_id, template_id)
    session.delete(template)
    session.commit()
