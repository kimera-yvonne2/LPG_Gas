from django.urls import path
from rest_framework.routers import DefaultRouter

from devices.views import (
    CylinderViewSet,
    DeviceBootstrapView,
    DeviceClaimView,
    DeviceConfigView,
    HouseholdViewSet,
    SensorViewSet,
)

app_name = "devices"

router = DefaultRouter()
router.register("households", HouseholdViewSet, basename="household")
router.register("cylinders", CylinderViewSet, basename="cylinder")
router.register("sensors", SensorViewSet, basename="sensor")

urlpatterns = [
    path("device/bootstrap/", DeviceBootstrapView.as_view(), name="device-bootstrap"),
    path("device/config/", DeviceConfigView.as_view(), name="device-config"),
    path("devices/claim/", DeviceClaimView.as_view(), name="device-claim"),
] + router.urls
