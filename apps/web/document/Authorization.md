# Authorization Contract — DYN CRM

> NestJS: permission-based RBAC + separate data scope.  
> Schema: users → roles → permission_groups → permissions.

## 1. Capability vs Scope vs Business Rule

| Layer | Question | Mechanism |
|-------|----------|-----------|
| **Capability** | Can the user perform this action *at all*? | Permission `resource.action` via RBAC Guard |
| **Data scope** | Which records may they act on? | Resource Policy (OWN / TEAM / ALL / ASSIGNED_CTV) |
| **Business rule** | Is this transition/state valid? | Domain application service |

Do **not** hard-code role names in controllers. Do **not** put scope into a giant permission table unless product requires persisted configurable scopes (MVP: code policies).

---

## 2. Permission catalog (seed)

Format: `resource.action`

### CRM
- `customer.view` `customer.create` `customer.update` `customer.delete` `customer.assign` `customer.import` `customer.export`
- `lead.view` `lead.create` `lead.update` `lead.delete` `lead.assign` `lead.convert` `lead.import`
- `contact.view` `contact.create` `contact.update` `contact.delete`

### Service
- `service.view` `service.create` `service.update` `service.archive`

### Legal
- `contract.view` `contract.create` `contract.update` `contract.delete` `contract.change_status`
- `workflow_template.manage` `task.view` `task.create` `task.update` `document.upload`

### Finance
- `order.view` `order.create` `order.update` `order.delete` `order.assign` `order.change_stage` `order.approve`
- `payment.view` `payment.create` `payment.verify` `payment.void`
- `vat.view` `vat.create` `vat.issue` `vat.cancel`
- `expense.view` `expense.create` `expense.approve`
- `commission.view` `commission.calculate` `commission.approve` `commission.pay`

### Collaboration
- `collaborator.view` `collaborator.create` `collaborator.update` `collaborator.deactivate`
- `contract_request.create` `contract_request.view` `contract_request.review` `contract_request.approve` `contract_request.reject`
- `collaborator_customer.assign`

### Identity / System
- `user.manage` `role.manage` `permission.manage`
- `notification.view_own` `config.manage`

Unknown permission ⇒ **deny**.

---

## 3. Role → Permission Group (starter matrix)

| Role code | Typical groups (illustrative) |
|-----------|-------------------------------|
| SUPER_ADMIN | all groups |
| ADMIN | identity.admin, crm.full, legal.full, finance.full, collab.admin, system.config |
| MANAGER | crm.manage, legal.read_write, finance.read, order.approve |
| LAWYER | legal.full, crm.read, order.view |
| LEGAL_ASSISTANT | legal.support, crm.read |
| ACCOUNTING | finance.full, crm.read, order.view |
| SALES | crm.full, lead.full, order.create_own |
| COLLABORATOR | collab.portal (own requests, assigned customers, own commission.view) |

Exact group membership is seed data — adjust without code changes.

---

## 4. Data scope policies

| Scope | Meaning |
|-------|---------|
| OWN | `owner_id` / `assigned_user_id` / `submitter_user_id` / `recipient_user_id` = current user |
| TEAM | Same team/department when org model exists. **OPEN (MVP):** `CustomerPolicy` currently treats TEAM list/detail like unfiltered (no owner filter) until org/manager mapping is locked — do not invent hierarchy. |
| ALL | No row filter beyond soft-delete |
| ASSIGNED_CTV | Customer in `collaborator_customers` for current collaborator profile |

Examples:

- Sales + `customer.update` + OWN → may update only owned customers.  
- Manager + `customer.view` + ALL → list all.  
- CTV + `customer.view` + ASSIGNED_CTV → assigned only.  
- Missing permission → **403**. Permission OK but out of scope → **403** (do not leak existence if security convention requires hide → **404** optional; default MVP **403**).

---

## 5. NestJS pipeline

```text
JWT → AuthGuard → Resolve User (+ roles/permissions)
    → @RequirePermission('customer.update')
    → CustomerPolicy (scope)
    → ApplicationService (business rules)
    → Repository → Prisma
```

Controllers stay thin. No `if (user.role === 'ADMIN')`.

---

## 6. Commands vs CRUD

| CRUD | Commands (POST …/:id/action) |
|------|------------------------------|
| PATCH entity fields | `orders/:id/assign`, `change-stage`, `approve` |
| | `payments/:id/verify`, `void` |
| | `vat/invoices/:id/issue`, `cancel` |
| | `expenses/:id/approve` |
| | `commissions/:id/calculate`, `approve`, `pay` |
| | `contract-requests/:id/review`, `approve`, `reject` |
