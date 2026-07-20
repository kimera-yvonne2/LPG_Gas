"""Compatibility import for the former Celery depletion task.

Forecasting now runs in the Django process and is throttled by completed
15-minute data buckets, so it needs neither a broker nor a worker.
"""

from telemetry.services import refresh_depletion_estimate_if_due


def generate_depletion_estimate_task(cylinder_id: int) -> int | None:
    return refresh_depletion_estimate_if_due(cylinder_id)
