import logging

from celery import shared_task

from devices.models import Cylinder
from telemetry.services import generate_depletion_estimate

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def generate_depletion_estimate_task(self, cylinder_id: int) -> int | None:
    """
    Generate a depletion estimate asynchronously.

    Returns the saved estimate ID. Missing cylinders are handled safely because
    retrying cannot restore a cylinder that no longer exists.
    """

    try:
        cylinder = Cylinder.objects.get(pk=cylinder_id)
    except Cylinder.DoesNotExist:
        logger.warning(
            "Depletion estimate task skipped because cylinder does not exist",
            extra={"cylinder_id": cylinder_id},
        )
        return None

    estimate = generate_depletion_estimate(cylinder)

    logger.info(
        "Depletion estimate task completed",
        extra={
            "cylinder_id": cylinder_id,
            "estimate_id": estimate.id,
            "status": estimate.status,
            "model_version": estimate.model_version,
        },
    )

    return estimate.id
