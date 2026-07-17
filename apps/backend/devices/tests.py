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


@pytest.fixture
def household_user():
    return User.objects.create_user(
        email="owner@example.com",
        username="owner",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )


@pytest.fixture
def other_household_user():
    return User.objects.create_user(
        email="other@example.com",
        username="other",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )


@pytest.fixture
def technician():
    return User.objects.create_user(
        email="tech-assets@example.com",
        username="tech-assets",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )


@pytest.fixture
def admin_user():
    return User.objects.create_superuser(
        email="admin-assets@example.com",
        username="admin-assets",
        password="Strong-Pass-123!",
    )


@pytest.fixture
def household(household_user):
    return Household.objects.create(owner=household_user)


@pytest.fixture
def cylinder(household):
    return Cylinder.objects.create(
        household=household,
        capacity=Decimal("6.000"),
        empty_weight=Decimal("8.000"),
        installation_date=timezone.localdate() - timedelta(days=1),
        status=Cylinder.Status.ACTIVE,
    )


def authenticate(client, user):
    client.force_authenticate(user=user)


def test_household_user_can_create_own_household_without_owner_id(api_client, household_user):
    authenticate(api_client, household_user)
    response = api_client.post(
        reverse("v1:devices:household-list"),
        {},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["owner"] == household_user.id


def test_household_list_is_paginated_and_owner_scoped(api_client, household, other_household_user):
    Household.objects.create(owner=other_household_user)
    authenticate(api_client, household.owner)
    response = api_client.get(reverse("v1:devices:household-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == household.id


def test_cylinder_stores_configuration_without_measurements(household):
    cylinder = Cylinder.objects.create(
        household=household,
        capacity=Decimal("6.000"),
        empty_weight=Decimal("5.000"),
        installation_date=timezone.localdate(),
    )
    assert cylinder.capacity == Decimal("6.000")
    assert cylinder.empty_weight == Decimal("5.000")
    assert not hasattr(cylinder, "current_weight")


def test_cylinder_api_rejects_negative_tare_weight(api_client, household):
    authenticate(api_client, household.owner)
    response = api_client.post(
        reverse("v1:devices:cylinder-list"),
        {
            "capacity": "6.000",
            "empty_weight": "-1.000",
            "installation_date": str(timezone.localdate()),
            "status": Cylinder.Status.ACTIVE,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "empty_weight" in response.data["detail"]


def test_household_cylinder_is_automatically_assigned_without_household_id(api_client, household):
    authenticate(api_client, household.owner)

    response = api_client.post(
        reverse("v1:devices:cylinder-list"),
        {
            "capacity": "6.000",
            "empty_weight": "8.000",
            "installation_date": str(timezone.localdate()),
            "status": Cylinder.Status.ACTIVE,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["household"] == household.id
    assert response.data["empty_weight"] == "8.000"
    assert response.data["full_weight"] == "14.000"
    assert response.data["latest_weight"] is None
    assert response.data["latest_gas_percentage"] is None
    assert response.data["latest_reading_at"] is None


def test_household_cannot_override_automatic_cylinder_household(
    api_client, household, other_household_user
):
    other_household = Household.objects.create(owner=other_household_user)
    authenticate(api_client, household.owner)

    response = api_client.post(
        reverse("v1:devices:cylinder-list"),
        {
            "household": other_household.id,
            "capacity": "6.000",
            "empty_weight": "8.000",
            "installation_date": str(timezone.localdate()),
            "status": Cylinder.Status.ACTIVE,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["household"] == household.id


def test_admin_cylinder_creation_still_requires_household(api_client, admin_user):
    authenticate(api_client, admin_user)

    response = api_client.post(
        reverse("v1:devices:cylinder-list"),
        {
            "capacity": "6.000",
            "empty_weight": "8.000",
            "installation_date": str(timezone.localdate()),
            "status": Cylinder.Status.ACTIVE,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "household" in response.data["detail"]


def test_household_cannot_access_another_households_cylinder(
    api_client, cylinder, other_household_user
):
    authenticate(api_client, other_household_user)
    response = api_client.get(reverse("v1:devices:cylinder-detail", args=[cylinder.id]))
    assert response.status_code == 404


def test_technician_cannot_see_cylinders_through_a_refill_request(api_client, cylinder):
    role = User.Role.TECHNICIAN
    user = User.objects.create_user(
        email=f"{role}-context@example.com",
        username=f"{role}-context",
        password="Strong-Pass-123!",
        role=role,
        email_verified=True,
    )
    refill_request = RefillRequest.objects.create(
        household=cylinder.household,
        assigned_technician=user,
        source=RefillRequest.Source.MANUAL,
    )
    authenticate(api_client, user)
    response = api_client.get(
        reverse("v1:devices:cylinder-list"),
        {"refill_request": refill_request.id, "search": "CYL-0001"},
    )
    assert response.status_code == 403


def test_technician_cannot_use_another_technicians_refill_context(api_client, cylinder, technician):
    assigned_technician = User.objects.create_user(
        email="assigned-context@example.com",
        username="assigned-context",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )
    refill_request = RefillRequest.objects.create(
        household=cylinder.household,
        assigned_technician=assigned_technician,
    )
    authenticate(api_client, technician)

    response = api_client.get(
        reverse("v1:devices:cylinder-list"),
        {"refill_request": refill_request.id},
    )

    assert response.status_code == 403


def test_technician_cannot_access_household_through_refill_context(
    api_client, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=cylinder.household,
        assigned_technician=technician,
    )
    authenticate(api_client, technician)

    response = api_client.get(
        reverse("v1:devices:household-list"),
        {"refill_request": refill_request.id},
    )

    assert response.status_code == 403


def test_technician_cannot_create_cylinder(api_client, household, technician):
    authenticate(api_client, technician)
    response = api_client.post(reverse("v1:devices:cylinder-list"), {}, format="json")
    assert response.status_code == 403


def test_inactive_users_are_blocked_but_legacy_unverified_users_are_allowed(api_client, household):
    inactive_user = User.objects.create_user(
        email="inactive@example.com",
        username="inactive",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
        is_active=False,
    )
    unverified_user = User.objects.create_user(
        email="unverified@example.com",
        username="unverified",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=False,
    )

    authenticate(api_client, inactive_user)
    assert api_client.get(reverse("v1:devices:household-list")).status_code == 403

    authenticate(api_client, unverified_user)
    assert api_client.get(reverse("v1:devices:household-list")).status_code == 200


def test_technician_cannot_register_sensor(api_client, cylinder, technician):
    authenticate(api_client, technician)
    response = api_client.post(
        reverse("v1:devices:sensor-list"),
        {
            "cylinder": cylinder.id,
            "esp32_id": "ESP32-0001",
            "mac_address": "aa:bb:cc:dd:ee:ff",
            "battery_level": "88.50",
            "online_status": True,
            "last_seen": (timezone.now() - timedelta(minutes=1)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 403


def test_household_can_create_update_and_delete_sensor_for_own_cylinder(api_client, cylinder):
    authenticate(api_client, cylinder.household.owner)

    create_response = api_client.post(
        reverse("v1:devices:sensor-list"),
        {
            "cylinder": cylinder.id,
            "esp32_id": "ESP32-READ",
            "mac_address": "AA:BB:CC:DD:EE:01",
            "battery_level": "90.00",
            "online_status": True,
            "last_seen": (timezone.now() - timedelta(minutes=1)).isoformat(),
        },
        format="json",
    )
    assert create_response.status_code == 201

    sensor = Sensor.objects.get(esp32_id="ESP32-READ")
    update_response = api_client.patch(
        reverse("v1:devices:sensor-detail", args=[sensor.id]),
        {"battery_level": "80.00"},
        format="json",
    )
    assert update_response.status_code == 200

    delete_response = api_client.delete(reverse("v1:devices:sensor-detail", args=[sensor.id]))
    assert delete_response.status_code == 200
    assert delete_response.data["result"] == "deleted"


def test_household_cannot_connect_sensor_to_another_households_cylinder(
    api_client, cylinder, other_household_user
):
    Household.objects.create(owner=other_household_user)
    authenticate(api_client, other_household_user)
    response = api_client.post(
        reverse("v1:devices:sensor-list"),
        {
            "cylinder": cylinder.id,
            "esp32_id": "ESP32-NOT-MINE",
            "mac_address": "AA:BB:CC:DD:EE:03",
            "battery_level": "100.00",
            "online_status": False,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "cylinder" in response.data["detail"]
    assert not Sensor.objects.filter(esp32_id="ESP32-NOT-MINE").exists()


def test_cylinder_delete_disconnects_device_when_there_is_no_history(
    api_client, cylinder, admin_user
):
    sensor = Sensor.objects.create(
        household=cylinder.household,
        cylinder=cylinder,
        esp32_id="ESP32-PROTECT",
        mac_address="AA:BB:CC:DD:EE:02",
        battery_level=Decimal("90.00"),
    )
    authenticate(api_client, admin_user)
    response = api_client.delete(reverse("v1:devices:cylinder-detail", args=[cylinder.id]))
    assert response.status_code == 200
    assert response.data["result"] == "deleted"
    assert not Cylinder.objects.filter(pk=cylinder.pk).exists()
    sensor.refresh_from_db()
    assert sensor.cylinder is None


def test_used_cylinder_is_retired_and_hidden_instead_of_destroyed(api_client, cylinder):
    sensor = Sensor.objects.create(
        household=cylinder.household,
        cylinder=cylinder,
        esp32_id="ESP32-HISTORY",
        mac_address="AA:BB:CC:DD:EE:20",
        battery_level=Decimal("90.00"),
    )
    Reading.objects.create(
        sensor=sensor,
        cylinder=cylinder,
        weight=Decimal("14.000"),
    )
    authenticate(api_client, cylinder.household.owner)

    response = api_client.delete(reverse("v1:devices:cylinder-detail", args=[cylinder.id]))

    assert response.status_code == 200
    assert response.data["result"] == "retired"
    cylinder.refresh_from_db()
    sensor.refresh_from_db()
    assert cylinder.status == Cylinder.Status.RETIRED
    assert sensor.cylinder is None
    assert api_client.get(reverse("v1:devices:cylinder-list")).data["count"] == 0


def test_replacing_cylinder_moves_device_and_preserves_reading_snapshot(api_client, cylinder):
    sensor = Sensor.objects.create(
        household=cylinder.household,
        cylinder=cylinder,
        esp32_id="ESP32-REPLACE",
        mac_address="AA:BB:CC:DD:EE:21",
        battery_level=Decimal("90.00"),
    )
    reading = Reading.objects.create(
        sensor=sensor,
        cylinder=cylinder,
        weight=Decimal("14.000"),
    )
    authenticate(api_client, cylinder.household.owner)

    response = api_client.post(
        reverse("v1:devices:cylinder-replace", args=[cylinder.id]),
        {
            "capacity": "6.000",
            "empty_weight": "8.000",
            "installation_date": str(timezone.localdate()),
        },
        format="json",
    )

    assert response.status_code == 201
    replacement = Cylinder.objects.get(pk=response.data["id"])
    cylinder.refresh_from_db()
    sensor.refresh_from_db()
    reading.refresh_from_db()
    assert cylinder.status == Cylinder.Status.RETIRED
    assert sensor.cylinder_id == replacement.id
    assert reading.cylinder_id == cylinder.id


def test_household_can_disconnect_and_reconnect_device(api_client, cylinder):
    sensor = Sensor.objects.create(
        household=cylinder.household,
        cylinder=cylinder,
        esp32_id="ESP32-MOVE",
        mac_address="AA:BB:CC:DD:EE:22",
        battery_level=Decimal("90.00"),
    )
    authenticate(api_client, cylinder.household.owner)

    disconnect = api_client.post(
        reverse("v1:devices:sensor-disconnect", args=[sensor.id]), {}, format="json"
    )
    connect = api_client.post(
        reverse("v1:devices:sensor-connect", args=[sensor.id]),
        {"cylinder": cylinder.id},
        format="json",
    )

    assert disconnect.status_code == 200
    assert disconnect.data["cylinder"] is None
    assert connect.status_code == 200
    assert connect.data["cylinder"] == cylinder.id
