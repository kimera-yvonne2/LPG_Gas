from datetime import timedelta
from decimal import Decimal, InvalidOperation

import pytest
from django.contrib.auth.hashers import make_password
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from refills.models import RefillRequest
from telemetry.models import DepletionEstimate, Reading
from telemetry.services import generate_depletion_estimate
from telemetry.tasks import generate_depletion_estimate_task

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def make_user(email, role):
    return User.objects.create_user(
        email=email,
        username=email.split("@")[0],
        password="Strong-Pass-123!",
        role=role,
        email_verified=True,
    )


@pytest.fixture
def asset_graph():
    owner = make_user("reading-owner@example.com", User.Role.HOUSEHOLD)
    household = Household.objects.create(owner=owner)
    cylinder = Cylinder.objects.create(
        household=household,
        capacity=Decimal("6.000"),
        empty_weight=Decimal("5.000"),
        installation_date=timezone.localdate(),
    )
    sensor = Sensor.objects.create(
        household=household,
        cylinder=cylinder,
        esp32_id="ESP32-READING",
        mac_address="AA:BB:CC:DD:EE:10",
        battery_level=Decimal("75.00"),
        online_status=True,
        last_seen=timezone.now() - timedelta(minutes=1),
    )
    return owner, cylinder, sensor


def create_prediction_readings(sensor, cylinder):
    now = timezone.now()

    readings = [
        (now - timedelta(days=4), Decimal("10.000")),
        (now - timedelta(days=3), Decimal("9.200")),
        (now - timedelta(days=2), Decimal("8.300")),
        (now - timedelta(days=1), Decimal("7.300")),
        (now - timedelta(hours=1), Decimal("6.500")),
    ]

    for timestamp, weight in readings:
        Reading.objects.create(
            sensor=sensor,
            cylinder=cylinder,
            timestamp=timestamp,
            weight=weight,
        )


def authenticate_device(sensor, secret="device-test-secret"):
    sensor.device_secret_hash = make_password(secret)
    sensor.save(update_fields=("device_secret_hash", "updated_at"))
    return {
        "HTTP_X_DEVICE_ID": sensor.esp32_id,
        "HTTP_X_DEVICE_SECRET": secret,
    }


def test_device_ingests_telemetry_and_updates_presence(api_client, asset_graph):
    _, cylinder, sensor = asset_graph
    sensor.online_status = False
    sensor.save(update_fields=("online_status", "updated_at"))
    headers = authenticate_device(sensor)

    response = api_client.post(
        reverse("v1:telemetry:device-telemetry"),
        {
            "message_id": "ESP32-READING-BOOT2-0001",
            "weight": "8.250",
            "mq2_raw": 850,
            "mq2_ready": True,
            "gas_leak_detected": False,
            "hx711_ok": True,
        },
        format="json",
        **headers,
    )

    assert response.status_code == 201
    assert response.data["cylinder"] == cylinder.id
    assert response.data["gas_percentage"] == "54.17"
    assert response.data["duplicate"] is False
    sensor.refresh_from_db()
    assert sensor.online_status is True
    assert sensor.last_seen is not None


def test_device_telemetry_is_idempotent(api_client, asset_graph):
    _, _, sensor = asset_graph
    headers = authenticate_device(sensor)
    payload = {
        "message_id": "ESP32-READING-BOOT2-RETRY",
        "weight": "8.250",
        "mq2_raw": 850,
        "mq2_ready": True,
        "gas_leak_detected": False,
        "hx711_ok": True,
    }
    first = api_client.post(
        reverse("v1:telemetry:device-telemetry"), payload, format="json", **headers
    )
    second = api_client.post(
        reverse("v1:telemetry:device-telemetry"), payload, format="json", **headers
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.data["duplicate"] is True
    assert Reading.objects.filter(message_id=payload["message_id"]).count() == 1


def test_device_preserves_mq2_telemetry_when_weight_is_unavailable(api_client, asset_graph):
    _, _, sensor = asset_graph
    headers = authenticate_device(sensor)
    response = api_client.post(
        reverse("v1:telemetry:device-telemetry"),
        {
            "message_id": "ESP32-READING-HX711-FAIL",
            "weight": None,
            "mq2_raw": 1800,
            "mq2_ready": True,
            "gas_leak_detected": True,
            "hx711_ok": False,
        },
        format="json",
        **headers,
    )

    assert response.status_code == 201
    assert response.data["weight"] is None
    assert response.data["gas_percentage"] is None
    assert response.data["gas_leak_detected"] is True


def test_device_telemetry_rejects_invalid_secret(api_client, asset_graph):
    _, _, sensor = asset_graph
    authenticate_device(sensor)
    response = api_client.post(
        reverse("v1:telemetry:device-telemetry"),
        {},
        format="json",
        HTTP_X_DEVICE_ID=sensor.esp32_id,
        HTTP_X_DEVICE_SECRET="wrong-secret",
    )
    assert response.status_code == 401


def test_admin_creates_reading_and_cylinder_exposes_latest_telemetry(api_client, asset_graph):
    _, cylinder, sensor = asset_graph
    admin = make_user("reading-admin@example.com", User.Role.ADMIN)
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "timestamp": (timezone.now() - timedelta(seconds=1)).isoformat(),
            "weight": "6.500",
            "message_id": "ESP32-READING-BOOT1-0001",
            "mq2_raw": 1234,
            "mq2_ready": True,
            "hx711_ok": True,
            "gas_leak_detected": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["gas_percentage"] == "25.00"
    assert response.data["cylinder"] == cylinder.id
    assert response.data["gas_leak_detected"] is True
    assert response.data["mq2_raw"] == 1234
    assert response.data["mq2_ready"] is True
    assert response.data["hx711_ok"] is True
    assert Reading.objects.get(pk=response.data["id"]).weight == Decimal("6.500")

    cylinder_response = api_client.get(
        reverse("v1:devices:cylinder-detail", args=[cylinder.id])
    )
    assert cylinder_response.status_code == 200
    assert cylinder_response.data["latest_weight"] == "6.500"
    assert cylinder_response.data["latest_gas_percentage"] == "25.00"
    assert cylinder_response.data["latest_reading_at"] == response.data["timestamp"]


def test_technician_cannot_create_reading(api_client, asset_graph):
    _, _, sensor = asset_graph
    technician = make_user("reading-tech@example.com", User.Role.TECHNICIAN)
    api_client.force_authenticate(technician)

    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "weight": "7.500",
        },
        format="json",
    )

    assert response.status_code == 403


def test_reading_rejects_weight_outside_cylinder_limits(api_client, asset_graph):
    _, _, sensor = asset_graph
    admin = make_user("invalid-admin@example.com", User.Role.ADMIN)
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "weight": "4.000",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "weight" in response.data["detail"]


def test_household_reads_only_owned_readings(api_client, asset_graph):
    owner, _, sensor = asset_graph
    Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(minutes=1),
        weight=Decimal("8.000"),
    )
    api_client.force_authenticate(owner)
    response = api_client.get(reverse("v1:telemetry:reading-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["esp32_id"] == sensor.esp32_id


def test_technician_cannot_see_readings_through_a_refill_request(api_client, asset_graph):
    owner, _, sensor = asset_graph
    Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(minutes=2),
        weight=Decimal("8.500"),
    )
    user = make_user("reading-context@example.com", User.Role.TECHNICIAN)
    refill_request = RefillRequest.objects.create(
        household=owner.household,
        assigned_technician=user,
        source=RefillRequest.Source.MANUAL,
    )
    api_client.force_authenticate(user)
    response = api_client.get(
        reverse("v1:telemetry:reading-list"), {"refill_request": refill_request.id}
    )
    assert response.status_code == 403


def test_household_cannot_create_or_modify_readings(api_client, asset_graph):
    owner, _, _ = asset_graph
    api_client.force_authenticate(owner)
    assert api_client.post(reverse("v1:telemetry:reading-list"), {}).status_code == 403
    assert api_client.put(reverse("v1:telemetry:reading-detail", args=[1]), {}).status_code == 403


def test_reading_filter_search_order_and_pagination(api_client, asset_graph):
    owner, _, sensor = asset_graph
    old = Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(hours=2),
        weight=Decimal("7.000"),
    )
    recent = Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(minutes=2),
        weight=Decimal("9.000"),
    )
    api_client.force_authenticate(owner)
    response = api_client.get(
        reverse("v1:telemetry:reading-list"),
        {
            "search": sensor.esp32_id,
            "weight_min": 8,
            "ordering": "-weight",
            "page_size": 1,
        },
    )
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == recent.id
    assert response.data["results"][0]["id"] != old.id


def test_duplicate_sensor_timestamp_is_rejected(api_client, asset_graph):
    _, _, sensor = asset_graph
    admin = make_user("duplicate-admin@example.com", User.Role.ADMIN)
    timestamp = timezone.now() - timedelta(minutes=1)
    Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timestamp,
        weight=Decimal("8.000"),
    )
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "timestamp": timestamp.isoformat(),
            "weight": "8.500",
        },
        format="json",
    )
    assert response.status_code == 400


def test_disconnected_device_cannot_send_reading(api_client, asset_graph):
    _, _, sensor = asset_graph
    admin = make_user("disconnected-admin@example.com", User.Role.ADMIN)
    sensor.cylinder = None
    sensor.save(update_fields=("cylinder",))
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "weight": "8.000",
            "gas_leak_detected": False,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "sensor" in response.data["detail"]


def test_generate_depletion_estimate_success(asset_graph):
    _, cylinder, sensor = asset_graph
    create_prediction_readings(sensor, cylinder)

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.AVAILABLE
    assert estimate.model_name == "weighted-average-depletion"
    assert estimate.model_version == "1.0.0"
    assert estimate.input_reading_count == 5
    assert estimate.estimated_days_remaining is not None
    assert estimate.estimated_days_remaining > 0
    assert estimate.estimated_depletion_at is not None
    assert estimate.lower_bound_at is not None
    assert estimate.upper_bound_at is not None
    assert estimate.lower_bound_at <= estimate.estimated_depletion_at
    assert estimate.estimated_depletion_at <= estimate.upper_bound_at
    assert estimate.confidence_score is not None
    assert Decimal("0") <= estimate.confidence_score <= Decimal("1")


def test_generate_depletion_estimate_returns_insufficient_data(asset_graph):
    _, cylinder, sensor = asset_graph

    Reading.objects.create(
        sensor=sensor,
        cylinder=cylinder,
        timestamp=timezone.now() - timedelta(hours=2),
        weight=Decimal("9.000"),
    )

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.INSUFFICIENT_DATA
    assert estimate.estimated_days_remaining is None
    assert estimate.estimated_depletion_at is None
    assert estimate.lower_bound_at is None
    assert estimate.upper_bound_at is None
    assert estimate.input_reading_count == 1
    assert "At least 5 recent readings are required" in estimate.failure_reason


def test_generate_depletion_estimate_returns_stale_data(asset_graph):
    _, cylinder, sensor = asset_graph
    now = timezone.now()

    readings = [
        (now - timedelta(days=6), Decimal("10.000")),
        (now - timedelta(days=5), Decimal("9.500")),
        (now - timedelta(days=4), Decimal("9.000")),
        (now - timedelta(days=3), Decimal("8.500")),
        (now - timedelta(days=2), Decimal("8.000")),
    ]

    for timestamp, weight in readings:
        Reading.objects.create(
            sensor=sensor,
            cylinder=cylinder,
            timestamp=timestamp,
            weight=weight,
        )

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.STALE_DATA
    assert estimate.estimated_days_remaining is None
    assert estimate.estimated_depletion_at is None
    assert estimate.lower_bound_at is None
    assert estimate.upper_bound_at is None
    assert estimate.input_reading_count == 5
    assert "more than 24 hours old" in estimate.failure_reason


def test_generate_depletion_estimate_uses_readings_after_latest_refill(asset_graph):
    _, cylinder, sensor = asset_graph
    now = timezone.now()

    readings = [
        (now - timedelta(days=6), Decimal("8.000")),
        (now - timedelta(days=5), Decimal("7.500")),
        # Weight rises sharply here, so this should be treated as a refill.
        (now - timedelta(days=4), Decimal("10.000")),
        (now - timedelta(days=3), Decimal("9.200")),
        (now - timedelta(days=2), Decimal("8.400")),
        (now - timedelta(days=1), Decimal("7.600")),
        (now - timedelta(hours=1), Decimal("6.800")),
    ]

    for timestamp, weight in readings:
        Reading.objects.create(
            sensor=sensor,
            cylinder=cylinder,
            timestamp=timestamp,
            weight=weight,
        )

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.AVAILABLE
    assert estimate.input_reading_count == 5
    assert estimate.input_started_at == readings[2][0]
    assert estimate.input_ended_at == readings[-1][0]


def test_household_can_view_own_depletion_estimate(api_client, asset_graph):
    owner, cylinder, _ = asset_graph

    estimate = DepletionEstimate.objects.create(
        cylinder=cylinder,
        status=DepletionEstimate.Status.AVAILABLE,
        estimated_depletion_at=timezone.now() + timedelta(days=5),
        lower_bound_at=timezone.now() + timedelta(days=4),
        upper_bound_at=timezone.now() + timedelta(days=7),
        estimated_days_remaining=Decimal("5.00"),
        confidence_score=Decimal("0.80"),
        model_name="weighted-average-depletion",
        model_version="1.0.0",
        input_reading_count=5,
        input_started_at=timezone.now() - timedelta(days=4),
        input_ended_at=timezone.now() - timedelta(hours=1),
    )

    api_client.force_authenticate(owner)

    response = api_client.get(reverse("v1:telemetry:depletion-estimate-list"))

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == estimate.id
    assert response.data["results"][0]["cylinder"] == cylinder.id
    assert response.data["results"][0]["model_version"] == "1.0.0"
    assert "safety guarantee" in response.data["results"][0]["disclaimer"]


def test_household_cannot_view_another_households_depletion_estimate(
    api_client,
    asset_graph,
):
    owner, _, _ = asset_graph

    other_owner = make_user(
        "other-household@example.com",
        User.Role.HOUSEHOLD,
    )
    other_household = Household.objects.create(owner=other_owner)
    other_cylinder = Cylinder.objects.create(
        household=other_household,
        capacity=Decimal("6.000"),
        empty_weight=Decimal("5.000"),
        installation_date=timezone.localdate(),
    )

    DepletionEstimate.objects.create(
        cylinder=other_cylinder,
        status=DepletionEstimate.Status.AVAILABLE,
        estimated_depletion_at=timezone.now() + timedelta(days=5),
        lower_bound_at=timezone.now() + timedelta(days=4),
        upper_bound_at=timezone.now() + timedelta(days=7),
        estimated_days_remaining=Decimal("5.00"),
        confidence_score=Decimal("0.80"),
        model_name="weighted-average-depletion",
        model_version="1.0.0",
        input_reading_count=5,
        input_started_at=timezone.now() - timedelta(days=4),
        input_ended_at=timezone.now() - timedelta(hours=1),
    )

    api_client.force_authenticate(owner)

    response = api_client.get(reverse("v1:telemetry:depletion-estimate-list"))

    assert response.status_code == 200
    assert response.data["count"] == 0


def test_technician_cannot_access_depletion_estimates(api_client, asset_graph):
    _, cylinder, _ = asset_graph

    DepletionEstimate.objects.create(
        cylinder=cylinder,
        status=DepletionEstimate.Status.AVAILABLE,
        estimated_depletion_at=timezone.now() + timedelta(days=5),
        lower_bound_at=timezone.now() + timedelta(days=4),
        upper_bound_at=timezone.now() + timedelta(days=7),
        estimated_days_remaining=Decimal("5.00"),
        confidence_score=Decimal("0.80"),
        model_name="weighted-average-depletion",
        model_version="1.0.0",
        input_reading_count=5,
        input_started_at=timezone.now() - timedelta(days=4),
        input_ended_at=timezone.now() - timedelta(hours=1),
    )

    technician = make_user(
        "prediction-tech@example.com",
        User.Role.TECHNICIAN,
    )
    api_client.force_authenticate(technician)

    response = api_client.get(reverse("v1:telemetry:depletion-estimate-list"))

    assert response.status_code == 403


def test_depletion_task_creates_estimate(asset_graph):
    _, cylinder, sensor = asset_graph
    create_prediction_readings(sensor, cylinder)

    estimate_id = generate_depletion_estimate_task.run(cylinder.id)

    estimate = DepletionEstimate.objects.get(pk=estimate_id)

    assert estimate.cylinder == cylinder
    assert estimate.status == DepletionEstimate.Status.AVAILABLE
    assert estimate.model_version == "1.0.0"


def test_depletion_task_handles_missing_cylinder():
    estimate_id = generate_depletion_estimate_task.run(999999)

    assert estimate_id is None
    assert DepletionEstimate.objects.count() == 0


def test_generate_depletion_estimate_handles_zero_consumption(asset_graph):
    _, cylinder, sensor = asset_graph
    now = timezone.now()

    readings = [
        (now - timedelta(days=4), Decimal("9.000")),
        (now - timedelta(days=3), Decimal("9.000")),
        (now - timedelta(days=2), Decimal("9.000")),
        (now - timedelta(days=1), Decimal("9.000")),
        (now - timedelta(hours=1), Decimal("9.000")),
    ]

    for timestamp, weight in readings:
        Reading.objects.create(
            sensor=sensor,
            cylinder=cylinder,
            timestamp=timestamp,
            weight=weight,
        )

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.INSUFFICIENT_DATA
    assert estimate.estimated_days_remaining is None
    assert estimate.estimated_depletion_at is None
    assert estimate.lower_bound_at is None
    assert estimate.upper_bound_at is None
    assert "reliable gas-consumption rate" in estimate.failure_reason


def test_generate_depletion_estimate_handles_calculation_failure(
    asset_graph,
    monkeypatch,
):
    _, cylinder, sensor = asset_graph
    create_prediction_readings(sensor, cylinder)

    def raise_calculation_error(values):
        raise InvalidOperation

    monkeypatch.setattr(
        "telemetry.services._weighted_average",
        raise_calculation_error,
    )

    estimate = generate_depletion_estimate(cylinder)

    assert estimate.status == DepletionEstimate.Status.FAILED
    assert estimate.estimated_days_remaining is None
    assert estimate.estimated_depletion_at is None
    assert estimate.lower_bound_at is None
    assert estimate.upper_bound_at is None
    assert estimate.model_name == "weighted-average-depletion"
    assert estimate.model_version == "1.0.0"
    assert "InvalidOperation" in estimate.failure_reason
