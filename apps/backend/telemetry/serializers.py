from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from telemetry.models import Reading
from telemetry.services import create_reading


class ReadingSerializer(serializers.ModelSerializer):
    esp32_id = serializers.CharField(source="sensor.esp32_id", read_only=True)
    cylinder_serial_number = serializers.CharField(
        source="sensor.cylinder.serial_number", read_only=True
    )

    class Meta:
        model = Reading
        fields = (
            "id",
            "sensor",
            "esp32_id",
            "cylinder_serial_number",
            "timestamp",
            "weight",
            "gas_percentage",
            "temperature",
            "signal_strength",
            "created_at",
        )
        read_only_fields = ("id", "gas_percentage", "created_at")

    def validate(self, attrs):
        candidate = Reading(**attrs)
        candidate.gas_percentage = candidate.calculate_gas_percentage()
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def create(self, validated_data):
        return create_reading(**validated_data)
