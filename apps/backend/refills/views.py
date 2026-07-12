from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from refills.models import RefillRequest
from refills.serializers import RefillRequestSerializer


class RefillRequestViewSet(viewsets.ModelViewSet):
    queryset = RefillRequest.objects.select_related("household", "cylinder").all()
    serializer_class = RefillRequestSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("household__name", "cylinder__serial_number", "status", "source")
    ordering_fields = ("requested_at", "updated_at", "status")
    ordering = ("-requested_at",)
