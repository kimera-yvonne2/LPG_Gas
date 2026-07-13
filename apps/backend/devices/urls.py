from rest_framework.routers import DefaultRouter

from devices.views import CylinderViewSet, HouseholdViewSet, SensorViewSet

app_name = "devices"

router = DefaultRouter()
router.register("households", HouseholdViewSet, basename="household")
router.register("cylinders", CylinderViewSet, basename="cylinder")
router.register("sensors", SensorViewSet, basename="sensor")

urlpatterns = router.urls
