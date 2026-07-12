from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from devices.models import Cylinder, Household, Sensor
from refills.models import RefillRequest

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
def service_provider():
    return User.objects.create_user(
        email="provider-assets@example.com",
        username="provider-assets",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )


@pytest.fixture
def household(household_user):
    return Household.objects.create(
        owner=household_user,
        name="Kampala Home",
        email="contact@example.com",
        phone="+256700000001",
        address="Ntinda, Kampala",
        number_of_people=4,
        usage_type=Household.UsageType.DOMESTIC,
    )


@pytest.fixture
def cylinder(household):
    return Cylinder.objects.create(
        household=household,
        serial_number="CYL-0001",
        capacity=Decimal("12.000"),
        empty_weight=Decimal("8.000"),
        current_weight=Decimal("14.000"),
        installation_date=timezone.localdate() - timedelta(days=1),
        status=Cylinder.Status.ACTIVE,
    )


def authenticate(client, user):
    client.force_authenticate(user=user)


def test_household_user_can_create_own_household_without_owner_id(api_client, household_user):
    authenticate(api_client, household_user)
    response = api_client.post(
        reverse("v1:devices:household-list"),
        {
            "name": "My Home",
            "email": "my-home@example.com",
            "phone": "+256700000002",
            "address": "Mukono",
            "number_of_people": 5,
            "usage_type": Household.UsageType.DOMESTIC,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["owner"] == household_user.id


def test_household_list_is_paginated_and_owner_scoped(api_client, household, other_household_user):
    Household.objects.create(
        owner=other_household_user,
        name="Other Home",
        email="other-home@example.com",
        phone="+256700000003",
        address="Entebbe",
        number_of_people=2,
        usage_type=Household.UsageType.DOMESTIC,
    )
    authenticate(api_client, household.owner)
    response = api_client.get(reverse("v1:devices:household-list"))
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == household.id


def test_cylinder_calculates_percentage_and_empty_status(household):
    cylinder = Cylinder.objects.create(
        household=household,
        serial_number="CYL-CALC",
        capacity=Decimal("10.000"),
        empty_weight=Decimal("5.000"),
        current_weight=Decimal("7.500"),
        installation_date=timezone.localdate(),
    )
    assert cylinder.gas_percentage == Decimal("25.00")

    cylinder.current_weight = cylinder.empty_weight
    cylinder.status = Cylinder.Status.ACTIVE
    cylinder.save()
    assert cylinder.gas_percentage == 0
    assert cylinder.status == Cylinder.Status.EMPTY


def test_cylinder_api_rejects_invalid_weight(api_client, household):
    authenticate(api_client, household.owner)
    response = api_client.post(
        reverse("v1:devices:cylinder-list"),
        {
            "household": household.id,
            "serial_number": "CYL-BAD",
            "capacity": "12.000",
            "empty_weight": "8.000",
            "current_weight": "7.000",
            "installation_date": str(timezone.localdate()),
            "status": Cylinder.Status.ACTIVE,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "current_weight" in response.data["detail"]


def test_household_cannot_access_another_households_cylinder(
    api_client, cylinder, other_household_user
):
    authenticate(api_client, other_household_user)
    response = api_client.get(reverse("v1:devices:cylinder-detail", args=[cylinder.id]))
    assert response.status_code == 404


@pytest.mark.parametrize("role", [User.Role.SERVICE_PROVIDER, User.Role.TECHNICIAN])
def test_operational_roles_only_see_cylinders_for_the_requested_refill_request_context(
    api_client, cylinder, role
):
    user = User.objects.create_user(
        email=f"{role}-context@example.com",
        username=f"{role}-context",
        password="Strong-Pass-123!",
        role=role,
        email_verified=True,
    )
    refill_request = RefillRequest.objects.create(
        household=cylinder.household,
        cylinder=cylinder,
        source=RefillRequest.Source.MANUAL,
    )
    authenticate(api_client, user)
    response = api_client.get(
        reverse("v1:devices:cylinder-list"),
        {"refill_request": refill_request.id, "search": "CYL-0001"},
    )
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["serial_number"] == cylinder.serial_number


def test_technician_cannot_create_cylinder(api_client, household, technician):
    authenticate(api_client, technician)
    response = api_client.post(reverse("v1:devices:cylinder-list"), {}, format="json")
    assert response.status_code == 403


def test_inactive_or_unverified_users_cannot_access_devices(api_client, household):
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
    assert api_client.get(reverse("v1:devices:household-list")).status_code == 403


def test_technician_can_register_sensor_and_mac_is_normalized(api_client, cylinder, technician):
    authenticate(api_client, technician)
    response = api_client.post(
        reverse("v1:devices:sensor-list"),
        {
            "cylinder": cylinder.id,
            "esp32_id": "ESP32-0001",
            "firmware_version": "1.0.0",
            "mac_address": "aa:bb:cc:dd:ee:ff",
            "battery_level": "88.50",
            "online_status": True,
            "last_seen": (timezone.now() - timedelta(minutes=1)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["mac_address"] == "AA:BB:CC:DD:EE:FF"


def test_household_can_create_update_and_delete_sensor_for_own_cylinder(api_client, cylinder):
    authenticate(api_client, cylinder.household.owner)

    create_response = api_client.post(
        reverse("v1:devices:sensor-list"),
        {
            "cylinder": cylinder.id,
            "esp32_id": "ESP32-READ",
            "firmware_version": "1.0.0",
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
        {"firmware_version": "2.0.0"},
        format="json",
    )
    assert update_response.status_code == 200

    delete_response = api_client.delete(reverse("v1:devices:sensor-detail", args=[sensor.id]))
    assert delete_response.status_code == 204


def test_protected_cylinder_delete_returns_validation_error(api_client, cylinder, service_provider):
    Sensor.objects.create(
        cylinder=cylinder,
        esp32_id="ESP32-PROTECT",
        firmware_version="1.0.0",
        mac_address="AA:BB:CC:DD:EE:02",
        battery_level=Decimal("90.00"),
    )
    authenticate(api_client, service_provider)
    response = api_client.delete(reverse("v1:devices:cylinder-detail", args=[cylinder.id]))
    assert response.status_code == 400
