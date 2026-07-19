from django.urls import include, path
from rest_framework.routers import DefaultRouter

from alerts.views import (
    AlertViewSet,
    NotificationViewSet,
    PushSubscriptionViewSet,
    WebPushConfigView,
)
from config.views import HealthView

router = DefaultRouter()
router.register("alerts", AlertViewSet, basename="alert")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("push-subscriptions", PushSubscriptionViewSet, basename="push-subscription")

urlpatterns = [
    path("", include(router.urls)),
    path("web-push/config/", WebPushConfigView.as_view(), name="web-push-config"),
    path("health/", HealthView.as_view(), name="health"),
    path("", include("accounts.urls")),
    path("", include("devices.urls")),
    path("", include("refills.urls")),
    path("", include("telemetry.urls")),
]
