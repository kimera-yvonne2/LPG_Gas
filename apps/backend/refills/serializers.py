from rest_framework import serializers

from refills.models import RefillRequest


class RefillRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefillRequest
        fields = (
            "id",
            "household",
            "cylinder",
            "status",
            "source",
            "requested_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "requested_at", "updated_at")

    def validate_household(self, household):
        request = self.context["request"]
        if request.user.role == "household" and household.owner_id != request.user.id:
            raise serializers.ValidationError("You can only create refill requests for your own household.")
        return household

    def validate_cylinder(self, cylinder):
        request = self.context["request"]
        if request.user.role == "household" and cylinder.household.owner_id != request.user.id:
            raise serializers.ValidationError("You can only request refills for your own cylinders.")
        return cylinder

    def create(self, validated_data):
        return RefillRequest.objects.create(**validated_data)
