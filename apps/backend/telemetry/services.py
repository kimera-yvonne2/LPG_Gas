from django.db import transaction
from telemetry.models import Reading


@transaction.atomic
def create_reading(**data) -> Reading:
    reading = Reading.objects.create(**data)
    cylinder = reading.cylinder
    cylinder.current_weight = reading.weight
    cylinder.save(
        update_fields=("current_weight", "gas_percentage", "status", "updated_at")
    )
    return reading
