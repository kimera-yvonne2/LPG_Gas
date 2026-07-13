from django.urls import path
from refills.views import RefillProviderListView, RefillRequestViewSet
from rest_framework.routers import DefaultRouter

app_name = "refills"

router = DefaultRouter()
router.register("refill-requests", RefillRequestViewSet, basename="refill-request")

urlpatterns = [
    path(
        "refill-providers/",
        RefillProviderListView.as_view(),
        name="refill-provider-list",
    ),
    *router.urls,
]
