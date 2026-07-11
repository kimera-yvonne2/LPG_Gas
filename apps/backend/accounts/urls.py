from django.urls import path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    EmailVerificationView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegistrationView,
    ResendVerificationView,
    UserViewSet,
)

app_name = "accounts"

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/register/", RegistrationView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("auth/password/reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "auth/password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/email/verify/", EmailVerificationView.as_view(), name="email-verify"),
    path(
        "auth/email/resend/",
        ResendVerificationView.as_view(),
        name="email-verification-resend",
    ),
] + router.urls
