from django.urls import path
from rest_framework.routers import DefaultRouter

from telemetry.views import DepletionEstimateViewSet, DeviceTelemetryView, ReadingViewSet

app_name = "telemetry"

router = DefaultRouter()
router.register("readings", ReadingViewSet, basename="reading")
router.register(
    "depletion-estimates",
    DepletionEstimateViewSet,
    basename="depletion-estimate",
)

urlpatterns = [
    path("device/telemetry/", DeviceTelemetryView.as_view(), name="device-telemetry"),
] + router.urls
