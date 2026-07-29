{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # PROJECT CONTEXT\
\
## Project Name\
\
Legal CRM & Practice Management System\
\
---\
\
# Product Vision\
\
This system is NOT a traditional CRM.\
\
It is an all-in-one Legal Practice Management System that helps law firms manage:\
\
- Customers\
- Legal Services\
- Legal Cases\
- Workflow\
- Documents\
- Finance\
- VAT Invoice\
- Collaborators\
- Commission\
- User Permission\
\
The system should support multiple legal services with customizable workflow templates.\
\
Every service may have different workflow stages.\
\
For example:\
\
Work Permit\
\
- Receive Documents\
- Draft\
- Submit\
- Waiting Result\
- Completed\
\
Visa\
\
- Passport Received\
- Prepare Documents\
- Biometric\
- Waiting Result\
- Passport Returned\
\
Company License\
\
- Consultation\
- Prepare Documents\
- Submit\
- Government Review\
- License Issued\
\
Workflow must NOT be hardcoded.\
\
Admin can configure workflow templates.\
\
---\
\
# Core Modules\
\
## Dashboard\
\
Purpose\
\
Quick overview of business performance.\
\
Features\
\
- Total Customers\
- Active Cases\
- Revenue\
- Pending Invoice\
- Expired Cases\
- Today's Tasks\
- Upcoming Deadlines\
\
---\
\
## CRM\
\
Purpose\
\
Manage customers.\
\
Entities\
\
Customer\
\
Company\
\
Contact Person\
\
Notes\
\
Activities\
\
Relationship\
\
One Customer\
\
\uc0\u8595 \
\
Many Cases\
\
\uc0\u8595 \
\
Many Invoices\
\
\uc0\u8595 \
\
Many Documents\
\
---\
\
## Service Catalog\
\
Purpose\
\
Manage all legal services.\
\
Example\
\
Work Permit\
\
Business License\
\
Visa\
\
Marriage Registration\
\
Trademark\
\
Investment License\
\
Each Service contains\
\
- Description\
- SLA\
- Required Documents\
- Workflow Template\
- Fee\
- VAT Rate\
\
Admin can create new services without developer support.\
\
---\
\
## Case Management\
\
Purpose\
\
Track legal cases.\
\
Case contains\
\
Customer\
\
Service\
\
Assigned Lawyer\
\
Status\
\
Priority\
\
Due Date\
\
Workflow\
\
Documents\
\
Timeline\
\
Comments\
\
History\
\
Every Case belongs to ONE Service.\
\
Every Service has ONE Workflow Template.\
\
When creating a case,\
\
Workflow is automatically generated from template.\
\
---\
\
## Workflow\
\
Workflow consists of multiple stages.\
\
Each Stage has\
\
Name\
\
Owner\
\
Deadline\
\
Estimated Days\
\
Actual Days\
\
Status\
\
Comment\
\
Attachment\
\
Completed Time\
\
Workflow should support\
\
Pending\
\
In Progress\
\
Waiting Customer\
\
Waiting Government\
\
Completed\
\
Rejected\
\
---\
\
## Document Management\
\
Every case has many documents.\
\
Each document has\
\
Category\
\
Version\
\
Uploader\
\
Created Date\
\
Preview\
\
Download\
\
Permission\
\
Support drag & drop upload.\
\
---\
\
## Finance\
\
Manage\
\
Quotation\
\
Invoice\
\
Payment\
\
Expense\
\
VAT Invoice\
\
Debt\
\
Each Invoice belongs to ONE Case.\
\
Payment updates Invoice Status automatically.\
\
---\
\
## Collaborator\
\
Purpose\
\
Manage referral partners.\
\
Collaborator\
\
\uc0\u8595 \
\
Customer\
\
\uc0\u8595 \
\
Contract\
\
\uc0\u8595 \
\
Payment\
\
\uc0\u8595 \
\
Commission\
\
Commission should be calculated automatically.\
\
Support multiple commission methods\
\
Percentage\
\
Fixed Amount\
\
Tier Level\
\
---\
\
## Permission\
\
Use RBAC.\
\
Roles\
\
Super Admin\
\
Admin\
\
Lawyer\
\
Sale\
\
Accountant\
\
Collaborator\
\
Each Role has\
\
Menu Permission\
\
Action Permission\
\
Data Scope\
\
Own Data\
\
Department\
\
All Data\
\
---\
\
# Design Principles\
\
Modern\
\
Minimal\
\
Professional\
\
Enterprise SaaS\
\
Simple\
\
Fast\
\
No unnecessary decoration.\
\
Use clean spacing.\
\
Use cards.\
\
Use table.\
\
Use drawer instead of popup when editing.\
\
---\
\
# UX Principles\
\
Always show\
\
Search\
\
Filter\
\
Sort\
\
Export\
\
Bulk Action\
\
Pagination\
\
Every detail page should contain tabs.\
\
Every table should support\
\
Search\
\
Filter\
\
Status\
\
Owner\
\
Date\
\
---\
\
# Technical Guideline\
\
Frontend\
\
NextJS\
\
React\
\
TypeScript\
\
Tailwind\
\
shadcn/ui\
\
Backend\
\
NestJS\
\
Database\
\
PostgreSQL\
\
ORM\
\
Prisma\
\
Authentication\
\
JWT\
\
Refresh Token\
\
RBAC\
\
Storage\
\
S3 Compatible\
\
Audit Log\
\
Every update must create Audit Log.\
\
Soft Delete\
\
Use soft delete for all business data.\
\
Never permanently delete business records.\
\
---\
\
# Important Rules\
\
Never hardcode workflow.\
\
Never hardcode service.\
\
Everything should be configurable.\
\
Always think in Enterprise SaaS architecture.\
\
Always separate\
\
Customer\
\
Service\
\
Case\
\
Workflow\
\
Finance\
\
Permission\
\
as independent modules.\
\
The system should be scalable for 100+ legal services.}