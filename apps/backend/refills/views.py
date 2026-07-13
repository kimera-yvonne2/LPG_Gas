from accounts.permissions import IsAdminRole, IsHousehold
from accounts.selectors import refill_provider_list
from django_filters.rest_framework import DjangoFilterBackend
from refills.models import RefillRequest
from refills.permissions import RefillRequestPermission
from refills.selectors import refill_request_list_for
from refills.serializers import (RefillProviderSerializer,
                                 RefillRequestSerializer,
                                 RefillTransitionSerializer)
from refills.services import transition_refill_request
from rest_framework import filters, generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


class RefillProviderListView(generics.ListAPIView):
    serializer_class = RefillProviderSerializer
    permission_classes = (IsHousehold | IsAdminRole,)

    def get_queryset(self):
        return refill_provider_list()


class RefillRequestViewSet(viewsets.ModelViewSet):
    queryset = RefillRequest.objects.none()
    serializer_class = RefillRequestSerializer
    permission_classes = (RefillRequestPermission,)
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = (
        "household__owner__username",
        "cylinder__serial_number",
        "status",
        "source",
    )
    ordering_fields = ("requested_at", "updated_at", "status")
    ordering = ("-requested_at",)

    def get_queryset(self):
        return refill_request_list_for(self.request.user)

    @action(detail=True, methods=("post",))
    def transition(self, request, pk=None):
        refill_request = self.get_object()
        serializer = RefillTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refill_request = transition_refill_request(
            refill_request_id=refill_request.id,
            status=serializer.validated_data["status"],
            actor=request.user,
        )
        return Response(self.get_serializer(refill_request).data)
