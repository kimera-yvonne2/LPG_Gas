from decimal import Decimal

import pytest
from accounts.models import User
from devices.models import Cylinder, Household
from django.urls import reverse
from django.utils import timezone
from refills.models import RefillRequest
from rest_framework.test import APIClient

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
    return Household.objects.create(owner=household_user)


@pytest.fixture
def technician():
    return User.objects.create_user(
        email="refill-technician@example.com",
        username="refill-technician",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
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
    api_client, household, cylinder, technician
):
    user = household.owner
    api_client.force_authenticate(user)

    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "assigned_technician": technician.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["status"] == RefillRequest.Status.PENDING
    assert response.data["source"] == RefillRequest.Source.MANUAL
    assert response.data["assigned_technician"] == technician.id

    request = RefillRequest.objects.get(pk=response.data["id"])
    request.transition_to(RefillRequest.Status.ACCEPTED)
    request.transition_to(RefillRequest.Status.IN_TRANSIT)
    request.transition_to(RefillRequest.Status.COMPLETED)
    request.save()

    assert request.status == RefillRequest.Status.COMPLETED


def test_refill_request_can_be_created_as_automatic_source(
    api_client, household, cylinder
):
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
    assert response.data["assigned_technician"] is None


def test_household_manual_refill_request_requires_technician(
    api_client, household, cylinder
):
    api_client.force_authenticate(household.owner)
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
    assert "assigned_technician" in response.data["detail"]


def test_household_cannot_assign_refill_request_to_non_technician(
    api_client, household, cylinder
):
    api_client.force_authenticate(household.owner)
    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "assigned_technician": household.owner.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "assigned_technician" in response.data["detail"]


def test_household_cannot_assign_refill_request_to_inactive_technician(
    api_client, household, cylinder
):
    inactive_technician = User.objects.create_user(
        email="inactive-refill-technician@example.com",
        username="inactive-refill-technician",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
        is_active=False,
    )
    api_client.force_authenticate(household.owner)
    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "assigned_technician": inactive_technician.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "assigned_technician" in response.data["detail"]


def test_household_cannot_create_refill_request_for_other_household(
    api_client, household, cylinder, technician
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
            "assigned_technician": technician.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )
    assert response.status_code == 400


def test_household_lists_only_active_verified_refill_providers(
    api_client, household_user, technician
):
    User.objects.create_user(
        email="unverified-provider@example.com",
        username="unverified-provider",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=False,
    )
    User.objects.create_user(
        email="inactive-provider@example.com",
        username="inactive-provider",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
        is_active=False,
    )
    api_client.force_authenticate(household_user)

    response = api_client.get(reverse("v1:refills:refill-provider-list"))

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"] == [
        {"id": technician.id, "name": technician.username}
    ]


def test_refill_provider_directory_does_not_expose_contact_details(
    api_client, household_user, technician
):
    api_client.force_authenticate(household_user)

    response = api_client.get(reverse("v1:refills:refill-provider-list"))

    provider = response.data["results"][0]
    assert provider == {"id": technician.id, "name": technician.username}
    assert "email" not in provider
    assert "phone_number" not in provider


def test_technician_cannot_access_refill_provider_directory(api_client, technician):
    api_client.force_authenticate(technician)

    response = api_client.get(reverse("v1:refills:refill-provider-list"))

    assert response.status_code == 403


def test_admin_can_access_refill_provider_directory(api_client, technician):
    admin = User.objects.create_superuser(
        email="refill-admin@example.com",
        username="refill-admin",
        password="Strong-Pass-123!",
    )
    api_client.force_authenticate(admin)

    response = api_client.get(reverse("v1:refills:refill-provider-list"))

    assert response.status_code == 200
    assert response.data["results"] == [
        {"id": technician.id, "name": technician.username}
    ]


def test_household_lists_only_own_refill_requests(
    api_client, household, cylinder, technician
):
    own_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    other_user = User.objects.create_user(
        email="other-list@example.com",
        username="other-list",
        password="Strong-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )
    other_household = Household.objects.create(owner=other_user)
    other_cylinder = Cylinder.objects.create(
        household=other_household,
        serial_number="CYL-OTHER-REFILL",
        capacity=Decimal("12.000"),
        empty_weight=Decimal("8.000"),
        current_weight=Decimal("10.000"),
        installation_date=timezone.localdate(),
    )
    RefillRequest.objects.create(
        household=other_household,
        cylinder=other_cylinder,
        assigned_technician=technician,
    )
    api_client.force_authenticate(household.owner)

    response = api_client.get(reverse("v1:refills:refill-request-list"))

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == own_request.id


def test_technician_lists_only_assigned_refill_requests(
    api_client, household, cylinder, technician
):
    assigned = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    other_technician = User.objects.create_user(
        email="other-technician@example.com",
        username="other-technician",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )
    RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=other_technician,
    )
    api_client.force_authenticate(technician)

    response = api_client.get(reverse("v1:refills:refill-request-list"))

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == assigned.id


def test_technician_cannot_retrieve_or_modify_another_technicians_request(
    api_client, household, cylinder, technician
):
    other_technician = User.objects.create_user(
        email="private-technician@example.com",
        username="private-technician",
        password="Strong-Pass-123!",
        role=User.Role.TECHNICIAN,
        email_verified=True,
    )
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=other_technician,
    )
    api_client.force_authenticate(technician)
    url = reverse("v1:refills:refill-request-detail", args=[refill_request.id])

    assert api_client.get(url).status_code == 404
    assert (
        api_client.patch(url, {"status": "accepted"}, format="json").status_code == 403
    )


def test_admin_lists_all_refill_requests(api_client, household, cylinder, technician):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    admin = User.objects.create_superuser(
        email="requests-admin@example.com",
        username="requests-admin",
        password="Strong-Pass-123!",
    )
    api_client.force_authenticate(admin)

    response = api_client.get(reverse("v1:refills:refill-request-list"))

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == refill_request.id


def test_assigned_technician_receives_customer_contact_in_refill_request(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    api_client.force_authenticate(technician)

    response = api_client.get(
        reverse("v1:refills:refill-request-detail", args=[refill_request.id])
    )

    assert response.status_code == 200
    assert response.data["customer"] == {
        "name": household.owner.username,
        "email": household.owner.email,
        "phone": household.owner.phone_number,
    }


def test_household_refill_response_does_not_duplicate_customer_contact(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    api_client.force_authenticate(household.owner)

    response = api_client.get(
        reverse("v1:refills:refill-request-detail", args=[refill_request.id])
    )

    assert response.status_code == 200
    assert response.data["customer"] is None


def test_admin_receives_customer_contact_in_refill_request(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    admin = User.objects.create_superuser(
        email="contact-admin@example.com",
        username="contact-admin",
        password="Strong-Pass-123!",
    )
    api_client.force_authenticate(admin)

    response = api_client.get(
        reverse("v1:refills:refill-request-detail", args=[refill_request.id])
    )

    assert response.status_code == 200
    assert response.data["customer"]["email"] == household.owner.email


def test_assigned_technician_progresses_refill_request_to_completion(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
    )
    api_client.force_authenticate(technician)
    url = reverse("v1:refills:refill-request-transition", args=[refill_request.id])

    for status in (
        RefillRequest.Status.ACCEPTED,
        RefillRequest.Status.IN_TRANSIT,
        RefillRequest.Status.COMPLETED,
    ):
        response = api_client.post(url, {"status": status}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == status


@pytest.mark.parametrize(
    ("starting_status", "expected_status"),
    [
        (RefillRequest.Status.PENDING, RefillRequest.Status.CANCELLED),
        (RefillRequest.Status.ACCEPTED, RefillRequest.Status.CANCELLED),
        (RefillRequest.Status.IN_TRANSIT, RefillRequest.Status.CANCELLED),
    ],
)
def test_assigned_technician_can_cancel_non_terminal_request(
    api_client, household, cylinder, technician, starting_status, expected_status
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=starting_status,
    )
    api_client.force_authenticate(technician)

    response = api_client.post(
        reverse("v1:refills:refill-request-transition", args=[refill_request.id]),
        {"status": RefillRequest.Status.CANCELLED},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == expected_status


@pytest.mark.parametrize(
    "starting_status",
    [RefillRequest.Status.PENDING, RefillRequest.Status.ACCEPTED],
)
def test_household_can_cancel_own_pending_or_accepted_request(
    api_client, household, cylinder, technician, starting_status
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=starting_status,
    )
    api_client.force_authenticate(household.owner)

    response = api_client.post(
        reverse("v1:refills:refill-request-transition", args=[refill_request.id]),
        {"status": RefillRequest.Status.CANCELLED},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == RefillRequest.Status.CANCELLED


def test_household_cannot_cancel_in_transit_request(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=RefillRequest.Status.IN_TRANSIT,
    )
    api_client.force_authenticate(household.owner)

    response = api_client.post(
        reverse("v1:refills:refill-request-transition", args=[refill_request.id]),
        {"status": RefillRequest.Status.CANCELLED},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "starting_status",
    [RefillRequest.Status.COMPLETED, RefillRequest.Status.CANCELLED],
)
def test_terminal_refill_request_cannot_transition(
    api_client, household, cylinder, technician, starting_status
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=starting_status,
    )
    api_client.force_authenticate(technician)

    response = api_client.post(
        reverse("v1:refills:refill-request-transition", args=[refill_request.id]),
        {"status": RefillRequest.Status.CANCELLED},
        format="json",
    )

    assert response.status_code == 400


def test_admin_can_cancel_in_transit_refill_request(
    api_client, household, cylinder, technician
):
    refill_request = RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=RefillRequest.Status.IN_TRANSIT,
    )
    admin = User.objects.create_superuser(
        email="transition-admin@example.com",
        username="transition-admin",
        password="Strong-Pass-123!",
    )
    api_client.force_authenticate(admin)

    response = api_client.post(
        reverse("v1:refills:refill-request-transition", args=[refill_request.id]),
        {"status": RefillRequest.Status.CANCELLED},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == RefillRequest.Status.CANCELLED


def test_cancelled_request_does_not_prevent_new_request_to_same_provider(
    api_client, household, cylinder, technician
):
    RefillRequest.objects.create(
        household=household,
        cylinder=cylinder,
        assigned_technician=technician,
        status=RefillRequest.Status.CANCELLED,
    )
    api_client.force_authenticate(household.owner)

    response = api_client.post(
        reverse("v1:refills:refill-request-list"),
        {
            "household": household.id,
            "cylinder": cylinder.id,
            "assigned_technician": technician.id,
            "source": RefillRequest.Source.MANUAL,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["assigned_technician"] == technician.id
