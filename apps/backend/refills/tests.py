from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from devices.models import Cylinder, Household
from refills.models import RefillRequest

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def household_user():
    return User.objects.create_user(
        email="refill-household@example.com",
        username="refill-household",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )


@pytest.fixture
def household(household_user):
    return Household.objects.create(
        owner=household_user,
        name="Refill Home",
        email="refill-home@example.com",
        phone="+256700000099",
        address="Kampala",
        number_of_people=3,
        usage_type=Household.UsageType.DOMESTIC,
    )


@pytest.fixture
def cylinder(household):
    return Cylinder.objects.create(
        household=household,
        serial_number="CYL-REFILL",
        capacity=Decimal("12.000"),
        empty_weight=Decimal("8.000"),
        current_weight=Decimal("10.500"),
        installation_date=timezone.localdate(),
        status=Cylinder.Status.ACTIVE,
    )


def test_refill_request_defaults_to_pending_manual_and_can_progress(
    api_client, household, cylinder
):
    user = household.owner
    api_client.force_authenticate(user)

    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["status"] == RefillRequest.Status.PENDING
    assert response.data["source"] == RefillRequest.Source.MANUAL

    request = RefillRequest.objects.get(pk=response.data["id"])
    request.transition_to(RefillRequest.Status.ACCEPTED)
    request.transition_to(RefillRequest.Status.IN_TRANSIT)
    request.transition_to(RefillRequest.Status.COMPLETED)
    request.save()

    assert request.status == RefillRequest.Status.COMPLETED


def test_refill_request_can_be_created_as_automatic_source(api_client, household, cylinder):
    api_client.force_authenticate(household.owner)
    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "source": RefillRequest.Source.AUTOMATIC,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["source"] == RefillRequest.Source.AUTOMATIC


def test_household_cannot_create_refill_request_for_other_household(
    api_client, household, cylinder
):
    other_user = User.objects.create_user(
        email="other-refill@example.com",
        username="other-refill",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )
    api_client.force_authenticate(other_user)
    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )
    assert response.status_code == 400
