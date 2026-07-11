from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from accounts.models import User


def _api_url(path: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{path}"


def send_verification_email(user: User) -> None:
    user.rotate_email_verification_token()
    user.save(update_fields=["email_verification_token", "email_verification_sent_at"])
    link = _api_url(f"/api/v1/auth/email/verify/?token={user.email_verification_token}")
    send_mail(
        subject="Verify your LPG Guardian email",
        message=f"Verify your email address by opening this link: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


@transaction.atomic
def register_household(*, email: str, username: str, password: str, phone_number: str = "") -> User:
    user = User.objects.create_user(
        email=email,
        username=username,
        password=password,
        phone_number=phone_number,
        role=User.Role.HOUSEHOLD,
    )
    send_verification_email(user)
    return user


def verify_email(token) -> User:
    user = User.objects.get(email_verification_token=token, email_verified=False)
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    return user


def send_password_reset_email(user: User) -> None:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = _api_url(f"/api/v1/auth/password/reset/confirm/?uid={uid}&token={token}")
    send_mail(
        subject="Reset your LPG Guardian password",
        message=f"Reset your password using this link: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


def can_resend_verification(user: User) -> bool:
    if not user.email_verification_sent_at:
        return True
    elapsed = timezone.now() - user.email_verification_sent_at
    return elapsed.total_seconds() >= settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
