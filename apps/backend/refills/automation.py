from decimal import Decimal

from accounts.models import User
from refills.models import RefillRequest
from refills.services import create_refill_request

AUTO_REFILL_THRESHOLD = Decimal("2.00")
AUTO_REFILL_REARM_THRESHOLD = Decimal("90.00")


def process_automatic_refill(reading) -> None:
    """Create at most one automatic request per genuinely refilled cylinder cycle."""
    percentage = reading.gas_percentage
    if percentage is None:
        return
    cylinder = reading.cylinder
    if percentage >= AUTO_REFILL_REARM_THRESHOLD and not cylinder.automatic_refill_armed:
        cylinder.automatic_refill_armed = True
        cylinder.save(update_fields=("automatic_refill_armed", "updated_at"))
        return
    household = cylinder.household
    provider = household.refill_provider
    if (
        percentage > AUTO_REFILL_THRESHOLD
        or not cylinder.automatic_refill_armed
        or not household.automatic_refills_enabled
        or provider is None
        or provider.role != User.Role.TECHNICIAN
        or not provider.is_active
    ):
        return
    create_refill_request(
        household=household,
        assigned_technician=provider,
        source=RefillRequest.Source.AUTOMATIC,
    )
    cylinder.automatic_refill_armed = False
    cylinder.save(update_fields=("automatic_refill_armed", "updated_at"))
