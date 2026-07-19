from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from accounts.models import User
from alerts.services import queue_email
from refills.models import RefillRequest


@transaction.atomic
def transition_refill_request(*, refill_request_id: int, status: str, actor: User) -> RefillRequest:
    refill_request = (
        RefillRequest.objects.select_for_update()
        .select_related(
            "household",
            "household__owner",
        )
        .get(pk=refill_request_id)
    )

    if actor.role == User.Role.HOUSEHOLD:
        if refill_request.household.owner_id != actor.id:
            raise PermissionDenied("You cannot update this refill request.")
        if status != RefillRequest.Status.CANCELLED or refill_request.status not in {
            RefillRequest.Status.PENDING,
            RefillRequest.Status.ACCEPTED,
        }:
            raise PermissionDenied(
                "Households can only cancel pending or accepted refill requests."
            )
    elif actor.role == User.Role.TECHNICIAN:
        if refill_request.assigned_technician_id != actor.id:
            raise PermissionDenied("You cannot update this refill request.")
    elif actor.role != User.Role.ADMIN:
        raise PermissionDenied("You cannot update refill requests.")

    try:
        refill_request.transition_to(status)
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc
    refill_request.save(update_fields=("status", "updated_at"))
    owner = refill_request.household.owner
    queue_email(
        subject=f"LPG Guardian: Refill request {refill_request.get_status_display()}",
        body=(
            f"Your refill request #{refill_request.id} status changed to "
            f"{refill_request.get_status_display()}."
        ),
        recipients=[owner.email],
    )
    if status == RefillRequest.Status.CANCELLED and actor.role == User.Role.HOUSEHOLD:
        technician = refill_request.assigned_technician
        if technician:
            queue_email(
                subject="LPG Guardian: Refill request cancelled",
                body=f"{owner.username} cancelled refill request #{refill_request.id}.",
                recipients=[technician.email],
            )
    return refill_request
