from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field


@dataclass
class TrainJobState:
    job_id: str
    status: str = "queued"  # queued|running|done|error
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    message: str | None = None

    # progress
    total_epochs: int | None = None
    current_epoch: int = 0
    metrics: list[dict] = field(default_factory=list)

    # results
    result: dict | None = None
    error: str | None = None


_lock = threading.Lock()
_jobs: dict[str, TrainJobState] = {}


def create_job(total_epochs: int | None = None) -> TrainJobState:
    job_id = uuid.uuid4().hex
    job = TrainJobState(job_id=job_id, total_epochs=total_epochs)
    with _lock:
        _jobs[job_id] = job
    return job


def get_job(job_id: str) -> TrainJobState | None:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **kwargs) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        for k, v in kwargs.items():
            setattr(job, k, v)
        job.updated_at = time.time()


def append_metric(job_id: str, metric: dict) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.metrics.append(metric)
        job.current_epoch = int(metric.get("epoch", job.current_epoch))
        job.updated_at = time.time()

