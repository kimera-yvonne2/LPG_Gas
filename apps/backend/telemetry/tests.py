from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from refills.models import RefillRequest
from telemetry.models import Reading

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
        serial_number="CYL-READ",
        capacity=Decimal("10.000"),
        empty_weight=Decimal("5.000"),
        current_weight=Decimal("10.000"),
        installation_date=timezone.localdate(),
    )
    sensor = Sensor.objects.create(
        household=household,
        cylinder=cylinder,
        esp32_id="ESP32-READING",
        firmware_version="1.0.0",
        mac_address="AA:BB:CC:DD:EE:10",
        battery_level=Decimal("75.00"),
        online_status=True,
        last_seen=timezone.now() - timedelta(minutes=1),
    )
    return owner, cylinder, sensor


def test_admin_creates_reading_and_updates_cylinder(api_client, asset_graph):
    _, cylinder, sensor = asset_graph
    admin = make_user("reading-admin@example.com", User.Role.ADMIN)
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "timestamp": (timezone.now() - timedelta(seconds=1)).isoformat(),
            "weight": "7.500",
            "temperature": "28.50",
            "signal_strength": -55,
            "gas_leak_detected": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["gas_percentage"] == "25.00"
    assert response.data["cylinder"] == cylinder.id
    assert response.data["gas_leak_detected"] is True
    cylinder.refresh_from_db()
    assert cylinder.current_weight == Decimal("7.500")
    assert cylinder.gas_percentage == Decimal("25.00")


def test_technician_cannot_create_reading(api_client, asset_graph):
    _, _, sensor = asset_graph
    technician = make_user("reading-tech@example.com", User.Role.TECHNICIAN)
    api_client.force_authenticate(technician)

    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "weight": "7.500",
            "temperature": "28.50",
            "signal_strength": -55,
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
            "temperature": "20.00",
            "signal_strength": -50,
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
        temperature=Decimal("25.00"),
        signal_strength=-60,
    )
    api_client.force_authenticate(owner)
    response = api_client.get(reverse("v1:telemetry:reading-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["esp32_id"] == sensor.esp32_id


def test_technician_cannot_see_readings_through_a_refill_request(
    api_client, asset_graph
):
    owner, _, sensor = asset_graph
    Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(minutes=2),
        weight=Decimal("8.500"),
        temperature=Decimal("25.50"),
        signal_strength=-58,
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
    assert (
        api_client.put(reverse("v1:telemetry:reading-detail", args=[1]), {}).status_code
        == 403
    )


def test_reading_filter_search_order_and_pagination(api_client, asset_graph):
    owner, _, sensor = asset_graph
    old = Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(hours=2),
        weight=Decimal("7.000"),
        temperature=Decimal("24.00"),
        signal_strength=-70,
    )
    recent = Reading.objects.create(
        sensor=sensor,
        cylinder=sensor.cylinder,
        timestamp=timezone.now() - timedelta(minutes=2),
        weight=Decimal("9.000"),
        temperature=Decimal("26.00"),
        signal_strength=-50,
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
        temperature=Decimal("25.00"),
        signal_strength=-60,
    )
    api_client.force_authenticate(admin)
    response = api_client.post(
        reverse("v1:telemetry:reading-list"),
        {
            "sensor": sensor.id,
            "timestamp": timestamp.isoformat(),
            "weight": "8.500",
            "temperature": "25.00",
            "signal_strength": -60,
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
            "temperature": "25.00",
            "signal_strength": -60,
            "gas_leak_detected": False,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "sensor" in response.data["detail"]
