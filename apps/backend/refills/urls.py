from rest_framework.routers import DefaultRouter

from refills.views import RefillRequestViewSet

app_name = "refills"

router = DefaultRouter()
router.register("refill-requests", RefillRequestViewSet, basename="refill-request")

urlpatterns = router.urls
