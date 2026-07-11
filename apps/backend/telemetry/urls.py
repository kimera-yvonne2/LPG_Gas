from rest_framework.routers import DefaultRouter

from telemetry.views import ReadingViewSet

app_name = "telemetry"

router = DefaultRouter()
router.register("readings", ReadingViewSet, basename="reading")

urlpatterns = router.urls
