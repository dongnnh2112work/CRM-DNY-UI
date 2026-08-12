import type { EmailRecord } from "./types";

export const MOCK_EMAILS: EmailRecord[] = [
  { id: "e1", subject: "Work Permit service promotion", recipients: ["contact@abc.vn", "info@techstartup.vn"], recipientCount: 2, status: "sent", sentAt: "2026-07-01", body: "<p>Dear customer, we are pleased to offer...</p>" },
  { id: "e2", subject: "Monthly newsletter - July 2026", recipients: ["contact@abc.vn", "nguyenvana@mail.com", "info@techstartup.vn", "tranthib@mail.com"], recipientCount: 4, status: "draft", body: "<p>Hello,</p><p>Here is our monthly update...</p>" },
  { id: "e3", subject: "Payment reminder", recipients: ["info@techstartup.vn"], recipientCount: 1, status: "scheduled", scheduledAt: "2026-08-01", body: "<p>This is a reminder that your payment is due...</p>" },
  { id: "e4", subject: "VAT invoice notice", recipients: ["contact@abc.vn"], recipientCount: 1, status: "sent", sentAt: "2026-07-05", body: "<p>Your VAT invoice is ready.</p>" },
  { id: "e5", subject: "Welcome — new customer onboarding", recipients: ["nguyenvana@mail.com", "tranthib@mail.com"], recipientCount: 2, status: "draft", body: "<p>Welcome aboard.</p>" },
  { id: "e6", subject: "License expiry warning", recipients: ["info@techstartup.vn", "ops@delta.vn"], recipientCount: 2, status: "failed", sentAt: "2026-07-10", body: "<p>Your license will expire soon.</p>" },
  { id: "e7", subject: "Commission statement — Q2", recipients: ["ctv1@mail.com", "ctv2@mail.com", "ctv3@mail.com"], recipientCount: 3, status: "sent", sentAt: "2026-07-12", body: "<p>Please find your commission statement.</p>" },
  { id: "e8", subject: "Service catalog update", recipients: ["contact@abc.vn", "info@techstartup.vn", "sales@xyz.vn"], recipientCount: 3, status: "scheduled", scheduledAt: "2026-08-15", body: "<p>Our service catalog has been updated.</p>" },
  { id: "e9", subject: "Order confirmation ORD-2026-009", recipients: ["tranthib@mail.com"], recipientCount: 1, status: "sent", sentAt: "2026-07-18", body: "<p>Your order has been confirmed.</p>" },
  { id: "e10", subject: "Follow-up: quotation pending", recipients: ["sales@xyz.vn", "contact@abc.vn"], recipientCount: 2, status: "draft", body: "<p>Just checking in on the quotation.</p>" },
  { id: "e11", subject: "System maintenance notice", recipients: ["ops@delta.vn", "info@techstartup.vn", "contact@abc.vn", "nguyenvana@mail.com"], recipientCount: 4, status: "failed", sentAt: "2026-07-22", body: "<p>Scheduled maintenance this weekend.</p>" },
  { id: "e12", subject: "Thank you for renewing", recipients: ["nguyenvana@mail.com"], recipientCount: 1, status: "sent", sentAt: "2026-07-28", body: "<p>Thank you for renewing your service.</p>" },
];
