from django.urls import path
from rest_framework.routers import DefaultRouter

from refills.views import RefillProviderListView, RefillRequestViewSet

app_name = "refills"

router = DefaultRouter()
router.register("refill-requests", RefillRequestViewSet, basename="refill-request")

urlpatterns = [
    path("refill-providers/", RefillProviderListView.as_view(), name="refill-provider-list"),
    *router.urls,
]
