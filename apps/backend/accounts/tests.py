import pytest
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from accounts.permissions import IsAdminRole, IsHousehold, IsTechnician
from devices.models import Household

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def household():
    return User.objects.create_user(
        email="home@example.com",
        username="home",
        password="Stronger-Pass-123!",
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )


@pytest.fixture
def admin_user():
    return User.objects.create_user(
        email="admin@example.com",
        username="admin",
        password="Stronger-Pass-123!",
        role=User.Role.ADMIN,
        email_verified=True,
        is_staff=True,
    )


def login(api_client, user):
    response = api_client.post(
        reverse("v1:accounts:login"),
        {"email": user.email, "password": "Stronger-Pass-123!"},
        format="json",
    )
    assert response.status_code == 200
    return response.data


def test_registration_creates_active_household_without_verification_email(api_client, mailoutbox):
    response = api_client.post(
        reverse("v1:accounts:register"),
        {
            "email": "new@example.com",
            "username": "new-home",
            "phone_number": "+256700000000",
            "password": "Stronger-Pass-123!",
            "password_confirm": "Stronger-Pass-123!",
        },
        format="json",
    )

    assert response.status_code == 201
    user = User.objects.get(email="new@example.com")
    assert user.role == User.Role.HOUSEHOLD
    assert user.email_verified
    assert user.check_password("Stronger-Pass-123!")
    assert user.household.owner_id == user.id
    assert len(mailoutbox) == 0


def test_registration_ignores_privileged_role_and_rejects_duplicate_email(
    api_client, household, mailoutbox
):
    privileged = api_client.post(
        reverse("v1:accounts:register"),
        {
            "email": "public@example.com",
            "username": "public",
            "password": "Stronger-Pass-123!",
            "password_confirm": "Stronger-Pass-123!",
            "role": User.Role.ADMIN,
        },
        format="json",
    )
    assert privileged.status_code == 201
    assert privileged.data["role"] == User.Role.HOUSEHOLD

    payload = {
        "email": household.email.upper(),
        "username": "different",
        "password": "Stronger-Pass-123!",
        "password_confirm": "Stronger-Pass-123!",
        "role": User.Role.ADMIN,
    }
    response = api_client.post(reverse("v1:accounts:register"), payload, format="json")
    assert response.status_code == 400
    assert "email" in response.data["detail"]


def test_legacy_unverified_user_can_login(api_client):
    user = User.objects.create_user(
        email="unverified@example.com",
        username="unverified",
        password="Stronger-Pass-123!",
    )
    response = api_client.post(
        reverse("v1:accounts:login"),
        {"email": user.email, "password": "Stronger-Pass-123!"},
        format="json",
    )
    assert response.status_code == 200


def test_login_returns_role_claim_and_refresh_rotates(api_client, household):
    tokens = login(api_client, household)
    access = AccessToken(tokens["access"])
    assert access["role"] == User.Role.HOUSEHOLD
    assert access["email_verified"] is True

    response = api_client.post(
        reverse("v1:accounts:token-refresh"),
        {"refresh": tokens["refresh"]},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["refresh"] != tokens["refresh"]


def test_logout_blacklists_refresh_token(api_client, household):
    tokens = login(api_client, household)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = api_client.post(
        reverse("v1:accounts:logout"), {"refresh": tokens["refresh"]}, format="json"
    )
    assert response.status_code == 204

    api_client.credentials()
    response = api_client.post(
        reverse("v1:accounts:token-refresh"),
        {"refresh": tokens["refresh"]},
        format="json",
    )
    assert response.status_code == 401


def test_email_verification_token_is_one_time(api_client):
    user = User.objects.create_user(
        email="verify@example.com", username="verify", password="Stronger-Pass-123!"
    )
    url = reverse("v1:accounts:email-verify")
    first = api_client.get(url, {"token": user.email_verification_token})
    second = api_client.get(url, {"token": user.email_verification_token})
    assert first.status_code == 204
    assert second.status_code == 400
    user.refresh_from_db()
    assert user.email_verified


def test_password_reset_is_enumeration_safe_and_changes_password(api_client, household, mailoutbox):
    request_url = reverse("v1:accounts:password-reset")
    assert api_client.post(request_url, {"email": "missing@example.com"}).status_code == 202
    assert len(mailoutbox) == 0
    assert api_client.post(request_url, {"email": household.email}).status_code == 202
    assert len(mailoutbox) == 1

    uid = urlsafe_base64_encode(force_bytes(household.pk))
    token = default_token_generator.make_token(household)
    response = api_client.post(
        reverse("v1:accounts:password-reset-confirm"),
        {
            "uid": uid,
            "token": token,
            "password": "Even-Stronger-456!",
            "password_confirm": "Even-Stronger-456!",
        },
        format="json",
    )
    assert response.status_code == 204
    household.refresh_from_db()
    assert household.check_password("Even-Stronger-456!")


def test_resend_verification_is_enumeration_safe_and_rate_limited(api_client, mailoutbox):
    user = User.objects.create_user(
        email="resend@example.com", username="resend", password="Stronger-Pass-123!"
    )
    url = reverse("v1:accounts:email-verification-resend")
    assert api_client.post(url, {"email": user.email}).status_code == 202
    assert api_client.post(url, {"email": user.email}).status_code == 202
    assert api_client.post(url, {"email": "missing@example.com"}).status_code == 202
    assert len(mailoutbox) == 1


def test_authenticated_user_can_read_me(api_client, household):
    tokens = login(api_client, household)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = api_client.get(reverse("v1:accounts:user-me"))
    assert response.status_code == 200
    assert response.data["email"] == household.email


def test_household_cannot_list_users(api_client, household):
    tokens = login(api_client, household)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert api_client.get(reverse("v1:accounts:user-list")).status_code == 403


def test_admin_can_create_technician_and_list_users(api_client, admin_user):
    tokens = login(api_client, admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = api_client.post(
        reverse("v1:accounts:user-list"),
        {
            "email": "tech@example.com",
            "username": "tech",
            "password": "Stronger-Pass-123!",
            "role": User.Role.TECHNICIAN,
            "phone_number": "",
            "is_active": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["role"] == User.Role.TECHNICIAN
    assert api_client.get(reverse("v1:accounts:user-list")).status_code == 200


def test_admin_created_household_account_is_automatically_provisioned(api_client, admin_user):
    tokens = login(api_client, admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    response = api_client.post(
        reverse("v1:accounts:user-list"),
        {
            "email": "managed-home@example.com",
            "username": "managed-home",
            "password": "Stronger-Pass-123!",
            "role": User.Role.HOUSEHOLD,
            "phone_number": "",
            "is_active": True,
        },
        format="json",
    )

    assert response.status_code == 201
    user = User.objects.get(email="managed-home@example.com")
    assert user.household.owner_id == user.id


def test_household_can_delete_account_and_reuse_original_email(api_client, household):
    Household.objects.create(owner=household)
    original_email = household.email
    original_username = household.username
    api_client.force_authenticate(household)

    response = api_client.delete(reverse("v1:accounts:user-me"))

    assert response.status_code == 204
    household.refresh_from_db()
    assert not household.is_active
    assert household.email != original_email
    assert household.username != original_username
    assert not household.has_usable_password()
    assert Household.objects.filter(owner=household).exists()

    api_client.force_authenticate(user=None)
    registration = api_client.post(
        reverse("v1:accounts:register"),
        {
            "email": original_email,
            "username": original_username,
            "password": "Stronger-Pass-123!",
            "password_confirm": "Stronger-Pass-123!",
        },
        format="json",
    )
    assert registration.status_code == 201


def test_non_household_cannot_use_self_service_account_deletion(api_client, admin_user):
    api_client.force_authenticate(admin_user)

    response = api_client.delete(reverse("v1:accounts:user-me"))

    assert response.status_code == 403
    admin_user.refresh_from_db()
    assert admin_user.is_active


@pytest.mark.parametrize(
    ("permission_class", "allowed_role"),
    [
        (IsAdminRole, User.Role.ADMIN),
        (IsHousehold, User.Role.HOUSEHOLD),
        (IsTechnician, User.Role.TECHNICIAN),
    ],
)
def test_role_permissions_allow_only_configured_roles(permission_class, allowed_role):
    class Request:
        user = User(role=allowed_role, is_active=True)

    assert permission_class().has_permission(Request(), None)

    Request.user.role = (
        User.Role.HOUSEHOLD if allowed_role != User.Role.HOUSEHOLD else User.Role.ADMIN
    )
    assert not permission_class().has_permission(Request(), None)


def test_openapi_schema_documents_authentication_endpoints(api_client):
    response = api_client.get(reverse("schema"), HTTP_ACCEPT="application/json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/auth/register/" in paths
    assert "/api/v1/auth/login/" in paths
    assert "/api/v1/auth/password/reset/confirm/" in paths
