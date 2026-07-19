import uuid

from django.db import transaction

from accounts.models import User


def ensure_household(user: User):
    if user.role != User.Role.HOUSEHOLD:
        return None
    from devices.models import Household

    household, _ = Household.objects.get_or_create(owner=user)
    return household


@transaction.atomic
def create_managed_user(*, password: str, **data) -> User:
    user = User.objects.create_user(password=password, **data)
    ensure_household(user)
    return user


@transaction.atomic
def register_household(*, email: str, username: str, password: str, phone_number: str = "") -> User:
    user = User.objects.create_user(
        email=email,
        username=username,
        password=password,
        phone_number=phone_number,
        role=User.Role.HOUSEHOLD,
        email_verified=True,
    )
    ensure_household(user)
    return user


@transaction.atomic
def delete_household_account(user: User) -> None:
    user = User.objects.select_for_update().get(pk=user.pk)
    if user.role != User.Role.HOUSEHOLD:
        raise PermissionError("Only household accounts can use self-service deletion.")
    marker = uuid.uuid4().hex
    user.email = f"deleted-{marker}@deleted.invalid"
    user.username = f"deleted-{user.pk}-{marker[:8]}"
    user.phone_number = ""
    user.email_verified = False
    user.is_active = False
    user.is_staff = False
    user.is_superuser = False
    user.set_unusable_password()
    user.save(
        update_fields=(
            "email",
            "username",
            "phone_number",
            "email_verified",
            "is_active",
            "is_staff",
            "is_superuser",
            "password",
        )
    )
