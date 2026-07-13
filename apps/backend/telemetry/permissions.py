from accounts.models import User
from rest_framework.permissions import SAFE_METHODS, BasePermission


class ReadingPermission(BasePermission):
    def has_permission(self, request, view):
        if (
            not request.user
            or not request.user.is_authenticated
            or not request.user.is_active
        ):
            return False
        if request.user.role == User.Role.HOUSEHOLD:
            return request.method in SAFE_METHODS
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS or request.method == "POST"
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        if request.user.role == User.Role.HOUSEHOLD:
            return (
                request.method in SAFE_METHODS
                and obj.cylinder.household.owner_id == request.user.id
            )
        if request.user.role == User.Role.TECHNICIAN:
            return request.method in SAFE_METHODS or request.method == "POST"
        return False
