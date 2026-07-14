from rest_framework.routers import DefaultRouter

from telemetry.views import DepletionEstimateViewSet, ReadingViewSet

app_name = "telemetry"

router = DefaultRouter()
router.register("readings", ReadingViewSet, basename="reading")
router.register(
    "depletion-estimates",
    DepletionEstimateViewSet,
    basename="depletion-estimate",
)

urlpatterns = router.urls
