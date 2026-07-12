# ADR 0001: Human identity, roles, permissions, tenant boundaries, and lifecycle

- Status: Proposed
- Date: 2026-07-11

## Context

The platform distinguishes between human users and device identities. Human actors must be authorized by role and tenant context, while devices continue to send telemetry data independently. The system must default to deny, enforce tenant isolation, and provide sufficient auditability for operational and security review.

## Decision

- Human identity is represented by the authenticated user account model.
- Device identity is represented separately by device and sensor records and is not treated as a human identity.
- The supported human roles are admin, household, service provider, and technician.
- Admin users retain full platform visibility and control.
- Service providers exist to receive and manage refill requests submitted by households.
- Technicians are the operational users assigned to a service provider and handle refill requests by processing the requested refill for the relevant household; they do not register devices.
- Household users register their own devices, receive alerts, submit refill requests, and access only their own household data.
- Devices continue to send sensor data as usual, and device-originated telemetry is handled separately from human account authorization.
- Access is explicitly allowed only for the relevant role, action, and tenant context. All other access is denied by default.
- Inactive, unauthenticated, unverified, or suspended users cannot access protected resources.
- The tenant boundary is the household owner context, meaning a household user can only access resources belonging to their own household unless an admin or a service-provider/technician workflow is acting within the permitted refill-processing context.

## Permission model

| Role | Households | Cylinders | Sensors | Readings / telemetry | Refill requests |
| --- | --- | --- | --- | --- | --- |
| Admin | Full read/write access across all tenants | Full read/write access across all tenants | Full read/write access across all tenants | Full read/write access across all tenants | Full read/write access across all tenants |
| Service provider | Read access for household context relevant to refill operations | Read access for cylinders relevant to refill operations | Read access for sensors relevant to refill operations | Read access for telemetry relevant to refill operations | Receive and manage refill requests for the provider |
| Technician | Read access for household context relevant to refill operations, including contact details needed to fulfill a refill request | Read access for cylinders relevant to refill operations | No direct sensor registration | Read access for telemetry relevant to refill operations | Process refill requests assigned to the technician |
| Household | Read/write access only for their own household | Read/write access only for cylinders belonging to their household | Read/write access for their own registered devices and sensors | Read access for readings from their household's sensors | Create and track refill requests for their own household |
| Device | No direct human-facing access | No direct human-facing access | No direct human-facing access | Ingest telemetry data only | No direct access |

## Notes on enforcement

- Default deny applies to every role and every resource.
- Household access is tenant-scoped to the household owner.
- Service providers and technicians are limited to refill-processing workflow access and do not receive unrestricted administrative authority.
- Household users, not technicians, are responsible for device registration.
- Technicians may read household context, including contact details, when needed to fulfill a refill request.
- Devices are not treated as human identities and do not receive general application permissions.

## Consequences

- The authorization model becomes easier to reason about and test.
- Tenant boundaries are explicit and aligned with household ownership.
- Operational roles are separated from general administration, reducing the risk of over-privileged access.
- Audit events and lifecycle checks become first-class requirements for security review and incident response.
