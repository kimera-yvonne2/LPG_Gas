import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from devices.models import Cylinder, Sensor
from telemetry.models import DepletionEstimate, Reading

logger = logging.getLogger(__name__)

MODEL_NAME = "weighted-average-depletion"
MODEL_VERSION = "1.0.0"

MINIMUM_READING_COUNT = 5
MINIMUM_DATA_SPAN = timedelta(hours=24)
PREDICTION_WINDOW = timedelta(days=7)
STALE_AFTER = timedelta(hours=24)

# A rise of at least 0.5 kg is treated as a possible refill.
REFILL_INCREASE_THRESHOLD = Decimal("0.500")

SECONDS_PER_DAY = Decimal("86400")
TWO_DECIMAL_PLACES = Decimal("0.01")


@transaction.atomic
def create_reading(**data) -> Reading:
    reading = Reading.objects.create(**data)

    from alerts.services import process_reading_alerts

    process_reading_alerts(reading)

    cylinder = reading.cylinder
    next_status = None
    if reading.gas_percentage is not None:
        next_status = (
            Cylinder.Status.EMPTY if reading.gas_percentage == 0 else Cylinder.Status.ACTIVE
        )
    if (
        next_status
        and cylinder.status in {Cylinder.Status.ACTIVE, Cylinder.Status.EMPTY}
        and (cylinder.status != next_status)
    ):
        cylinder.status = next_status
        cylinder.save(update_fields=("status", "updated_at"))
    from telemetry.tasks import generate_depletion_estimate_task

    if reading.weight is not None:
        transaction.on_commit(
            lambda: generate_depletion_estimate_task.delay(cylinder.id),
            robust=True,
        )
    return reading


@transaction.atomic
def ingest_device_telemetry(*, sensor: Sensor, **data) -> tuple[Reading, bool]:
    """Persist one authenticated device message and update its presence atomically."""

    # Lock only the sensor row. Joining the nullable cylinder relation here
    # makes PostgreSQL reject FOR UPDATE on the nullable side of the outer join.
    sensor = Sensor.objects.select_for_update().get(pk=sensor.pk)
    now = timezone.now()
    sensor.last_seen = now
    sensor.online_status = True
    sensor.save(update_fields=("last_seen", "online_status", "updated_at"))

    existing = Reading.objects.filter(message_id=data["message_id"]).first()
    if existing:
        if existing.sensor_id != sensor.id:
            raise ValueError("The message ID belongs to another device.")
        return existing, False

    reading = create_reading(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=now,
        **data,
    )
    return reading, True


def _save_fallback_estimate(
    *,
    cylinder: Cylinder,
    status: str,
    reason: str,
    readings: list[Reading],
) -> DepletionEstimate:
    """Save a safe state when a reliable forecast cannot be calculated."""

    return DepletionEstimate.objects.create(
        cylinder=cylinder,
        status=status,
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        input_reading_count=len(readings),
        input_started_at=readings[0].timestamp if readings else None,
        input_ended_at=readings[-1].timestamp if readings else None,
        failure_reason=reason,
    )


def _readings_after_latest_refill(readings: list[Reading]) -> list[Reading]:
    """
    Use only readings recorded after the most recent likely refill.

    A substantial increase in cylinder weight usually means that the cylinder
    was refilled.
    """

    start_index = 0

    for index in range(1, len(readings)):
        previous_weight = readings[index - 1].weight
        current_reading_weight = readings[index].weight

        if current_reading_weight - previous_weight >= REFILL_INCREASE_THRESHOLD:
            start_index = index

    return readings[start_index:]


def _calculate_consumption_rates(readings: list[Reading]) -> list[Decimal]:
    """
    Calculate consumption rates in kilograms per day.

    Zero or negative consumption is ignored because it does not represent
    measurable gas depletion.
    """

    rates: list[Decimal] = []

    for previous, current in zip(readings, readings[1:], strict=False):
        elapsed_seconds = Decimal(str((current.timestamp - previous.timestamp).total_seconds()))

        if elapsed_seconds <= 0:
            continue

        consumed = previous.weight - current.weight

        if consumed <= 0:
            continue

        elapsed_days = elapsed_seconds / SECONDS_PER_DAY
        daily_rate = consumed / elapsed_days

        if daily_rate > 0:
            rates.append(daily_rate)

    return rates


def _weighted_average(values: list[Decimal]) -> Decimal:
    """
    Give newer consumption rates more influence than older rates.

    For example, with three rates, the weights are 1, 2 and 3.
    """

    weights = [Decimal(index) for index in range(1, len(values) + 1)]

    weighted_total = sum(value * weight for value, weight in zip(values, weights, strict=True))
    weight_total = sum(weights)

    return weighted_total / weight_total


def _weighted_standard_deviation(
    values: list[Decimal],
    average: Decimal,
) -> Decimal:
    """Measure how much the observed consumption rates vary."""

    weights = [Decimal(index) for index in range(1, len(values) + 1)]
    weight_total = sum(weights)

    variance = (
        sum(
            weight * ((value - average) ** 2) for value, weight in zip(values, weights, strict=True)
        )
        / weight_total
    )

    return variance.sqrt()


def _calculate_confidence(
    *,
    reading_count: int,
    data_span: timedelta,
    average_rate: Decimal,
    deviation: Decimal,
) -> Decimal:
    """
    Produce a confidence score between zero and one.

    More readings, a longer observation period and stable consumption increase
    the confidence score.
    """

    reading_factor = min(
        Decimal(reading_count) / Decimal("20"),
        Decimal("1"),
    )

    span_days = Decimal(str(data_span.total_seconds())) / SECONDS_PER_DAY
    span_factor = min(span_days / Decimal("7"), Decimal("1"))

    if average_rate <= 0:
        stability_factor = Decimal("0")
    else:
        relative_variation = deviation / average_rate
        stability_factor = max(
            Decimal("0"),
            Decimal("1") - min(relative_variation, Decimal("1")),
        )

    confidence = reading_factor * span_factor * stability_factor

    return confidence.quantize(TWO_DECIMAL_PLACES)


def generate_depletion_estimate(cylinder: Cylinder) -> DepletionEstimate:
    """
    Generate and save a versioned LPG depletion estimate.

    This result is only a forecast based on recent consumption. It must never
    be presented as a safety guarantee.
    """

    now = timezone.now()
    window_start = now - PREDICTION_WINDOW

    readings = list(
        Reading.objects.filter(
            cylinder=cylinder,
            timestamp__gte=window_start,
            weight__isnull=False,
        )
        .select_related("sensor", "cylinder")
        .order_by("timestamp")
    )

    if len(readings) < MINIMUM_READING_COUNT:
        logger.info(
            "Depletion estimate unavailable due to insufficient readings",
            extra={
                "cylinder_id": cylinder.id,
                "reading_count": len(readings),
                "model_version": MODEL_VERSION,
            },
        )

        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.INSUFFICIENT_DATA,
            reason=(f"At least {MINIMUM_READING_COUNT} recent readings are required."),
            readings=readings,
        )

    readings = _readings_after_latest_refill(readings)

    if len(readings) < MINIMUM_READING_COUNT:
        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.INSUFFICIENT_DATA,
            reason="More readings are required after the latest detected refill.",
            readings=readings,
        )

    latest_reading = readings[-1]

    if now - latest_reading.timestamp > STALE_AFTER:
        logger.warning(
            "Depletion estimate unavailable because telemetry is stale",
            extra={
                "cylinder_id": cylinder.id,
                "latest_reading_at": latest_reading.timestamp.isoformat(),
                "model_version": MODEL_VERSION,
            },
        )

        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.STALE_DATA,
            reason="The latest sensor reading is more than 24 hours old.",
            readings=readings,
        )

    data_span = latest_reading.timestamp - readings[0].timestamp

    if data_span < MINIMUM_DATA_SPAN:
        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.INSUFFICIENT_DATA,
            reason="At least 24 hours of readings are required.",
            readings=readings,
        )

    rates = _calculate_consumption_rates(readings)

    if len(rates) < 2:
        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.INSUFFICIENT_DATA,
            reason="A reliable gas-consumption rate could not be determined.",
            readings=readings,
        )

    try:
        average_daily_use = _weighted_average(rates)
        deviation = _weighted_standard_deviation(
            rates,
            average_daily_use,
        )

        if average_daily_use <= 0:
            return _save_fallback_estimate(
                cylinder=cylinder,
                status=DepletionEstimate.Status.INSUFFICIENT_DATA,
                reason="No measurable gas consumption was detected.",
                readings=readings,
            )

        remaining_gas = max(
            latest_reading.weight - cylinder.empty_weight,
            Decimal("0"),
        )

        estimated_days = remaining_gas / average_daily_use

        # Even stable data should not imply perfect certainty.
        minimum_deviation = average_daily_use * Decimal("0.10")
        uncertainty = max(deviation, minimum_deviation)

        faster_rate = average_daily_use + uncertainty
        slower_rate = max(
            average_daily_use - uncertainty,
            average_daily_use * Decimal("0.25"),
        )

        earliest_days = remaining_gas / faster_rate
        latest_days = remaining_gas / slower_rate

        estimated_depletion_at = latest_reading.timestamp + timedelta(days=float(estimated_days))
        lower_bound_at = latest_reading.timestamp + timedelta(days=float(earliest_days))
        upper_bound_at = latest_reading.timestamp + timedelta(days=float(latest_days))

        confidence = _calculate_confidence(
            reading_count=len(readings),
            data_span=data_span,
            average_rate=average_daily_use,
            deviation=deviation,
        )

        estimate = DepletionEstimate.objects.create(
            cylinder=cylinder,
            status=DepletionEstimate.Status.AVAILABLE,
            estimated_depletion_at=estimated_depletion_at,
            lower_bound_at=lower_bound_at,
            upper_bound_at=upper_bound_at,
            estimated_days_remaining=estimated_days.quantize(TWO_DECIMAL_PLACES),
            confidence_score=confidence,
            model_name=MODEL_NAME,
            model_version=MODEL_VERSION,
            input_reading_count=len(readings),
            input_started_at=readings[0].timestamp,
            input_ended_at=latest_reading.timestamp,
            failure_reason="",
        )

        logger.info(
            "Depletion estimate generated",
            extra={
                "cylinder_id": cylinder.id,
                "estimate_id": estimate.id,
                "reading_count": len(readings),
                "model_version": MODEL_VERSION,
                "confidence_score": str(confidence),
            },
        )

        return estimate

    except (ArithmeticError, InvalidOperation, ValueError) as exc:
        logger.exception(
            "Depletion estimate calculation failed",
            extra={
                "cylinder_id": cylinder.id,
                "model_version": MODEL_VERSION,
            },
        )

        return _save_fallback_estimate(
            cylinder=cylinder,
            status=DepletionEstimate.Status.FAILED,
            reason=f"Prediction calculation failed: {type(exc).__name__}.",
            readings=readings,
        )
