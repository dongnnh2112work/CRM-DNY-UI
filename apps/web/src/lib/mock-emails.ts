import type { EmailRecord } from "./types";

export const MOCK_EMAILS: EmailRecord[] = [
  { id: "e1", subject: "Work Permit service promotion", recipients: ["contact@abc.vn", "info@techstartup.vn"], recipientCount: 2, status: "sent", sentAt: "2026-07-01", body: "<p>Dear customer, we are pleased to offer...</p>" },
  { id: "e2", subject: "Monthly newsletter - July 2026", recipients: ["contact@abc.vn", "nguyenvana@mail.com", "info@techstartup.vn", "tranthib@mail.com"], recipientCount: 4, status: "draft", body: "<p>Hello,</p><p>Here is our monthly update...</p>" },
  { id: "e3", subject: "Payment reminder", recipients: ["info@techstartup.vn"], recipientCount: 1, status: "scheduled", scheduledAt: "2026-08-01", body: "<p>This is a reminder that your payment is due...</p>" },
];
