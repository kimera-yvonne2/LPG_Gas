from rest_framework.permissions import BasePermission

from accounts.models import User


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role in self.allowed_roles
        )


class IsAdminRole(HasRole):
    allowed_roles = (User.Role.ADMIN,)


class IsHousehold(HasRole):
    allowed_roles = (User.Role.HOUSEHOLD,)


class IsTechnician(HasRole):
    allowed_roles = (User.Role.TECHNICIAN,)
