"use client";

import { CheckOutlined, CloseOutlined, SendOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Select, Space, Tag, Timeline, Typography } from "antd";
import { StatusBadge } from "@/components/shared/status-badge";
import { ds } from "@/lib/design-tokens";
import type { Order, OrderApprovalRequest, OrderStage } from "@/lib/types";
import { canApprove, canRequestTransition, hasLicenseDocument } from "@/lib/order-workflow";
import { MOCK_USERS } from "@/lib/mock-users";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { useUsers } from "@/lib/users-store";
import { useT } from "@/lib/use-t";

/** Fallback submitter mock when acting as submitter in demos */
export const MOCK_CURRENT_SUBMITTER = MOCK_USERS[2];

interface OrderApprovalPanelProps {
  order: Order;
  onChange: (next: Order) => void;
  actingAs?: "submitter" | "reviewer";
}

export function OrderApprovalPanel({ order, onChange, actingAs = "reviewer" }: OrderApprovalPanelProps) {
  const t = useT();
  const { message } = App.useApp();
  const { currentUser } = useUsers();
  const { stageOptions, getMeta } = useOrderStatusConfig();
  const [form] = Form.useForm();
  const reviewer = currentUser ?? MOCK_USERS[1];
  const actor =
    actingAs === "submitter"
      ? { id: order.submitterId, role: MOCK_CURRENT_SUBMITTER.role, name: order.submitterName }
      : { id: reviewer.id, role: reviewer.role, name: reviewer.name };

  const pending = order.approvalHistory.find(
    (h) => h.id === order.pendingTransition?.requestId && h.status === "pending",
  );

  const stageLabel = (key: OrderStage) => getMeta("orderStage", key).label;

  const canActAsSubmitter = actingAs === "submitter";
  const canActAsReviewer = actingAs === "reviewer" || canApprove(order, actor);
  const hasLicense = hasLicenseDocument(order);

  const handleRequest = (values: { toStage: OrderStage; note?: string }) => {
    if (!canActAsSubmitter && !canRequestTransition(order, actor.id)) {
      message.error(t("approval.onlySubmitter"));
      return;
    }
    if (order.approvalStatus === "pending_review") {
      message.warning(t("approval.alreadyPending"));
      return;
    }
    if (values.toStage === order.stage) {
      message.warning(t("approval.pickOtherStage"));
      return;
    }
    const reqId = `ar-${Date.now()}`;
    const request: OrderApprovalRequest = {
      id: reqId,
      fromStage: order.stage,
      toStage: values.toStage,
      requestedBy: order.submitterName,
      requestedAt: new Date().toISOString().slice(0, 10),
      note: values.note,
      status: "pending",
    };
    onChange({
      ...order,
      approvalStatus: "pending_review",
      pendingTransition: { toStage: values.toStage, requestId: reqId },
      approvalHistory: [...order.approvalHistory, request],
    });
    form.resetFields();
    message.success(t("approval.requested", { label: stageLabel(values.toStage) }));
  };

  const handleApprove = (reviewNote?: string) => {
    if (!canActAsReviewer) {
      message.error(t("approval.notReviewer"));
      return;
    }
    if (!pending || !order.pendingTransition) {
      message.warning(t("approval.noPending"));
      return;
    }
    const toStage = order.pendingTransition.toStage;
    onChange({
      ...order,
      stage: toStage,
      approvalStatus: "approved",
      pendingTransition: undefined,
      approvalHistory: order.approvalHistory.map((h) =>
        h.id === pending.id
          ? {
              ...h,
              status: "approved" as const,
              reviewedBy: order.reviewerName,
              reviewedAt: new Date().toISOString().slice(0, 10),
              reviewNote,
            }
          : h,
      ),
    });
    message.success(t("approval.approvedTo", { label: stageLabel(toStage) }));
  };

  const handleReject = (reviewNote?: string) => {
    if (!canActAsReviewer) {
      message.error(t("approval.notReviewer"));
      return;
    }
    if (!pending) {
      message.warning(t("approval.noPending"));
      return;
    }
    onChange({
      ...order,
      approvalStatus: "rejected",
      pendingTransition: undefined,
      approvalHistory: order.approvalHistory.map((h) =>
        h.id === pending.id
          ? {
              ...h,
              status: "rejected" as const,
              reviewedBy: order.reviewerName,
              reviewedAt: new Date().toISOString().slice(0, 10),
              reviewNote,
            }
          : h,
      ),
    });
    message.info(t("approval.rejectedKeep"));
  };

  const targetOptions = stageOptions
    .filter((s) => s.value !== order.stage)
    .map((s) => ({
      value: s.value,
      label: s.label,
    }));

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Typography.Text>{t("approval.statusLabel")}</Typography.Text>
        <StatusBadge module="approval" status={order.approvalStatus} />
        <Typography.Text type="secondary">
          {t("approval.people", { submitter: order.submitterName, reviewer: order.reviewerName ?? "—" })}
        </Typography.Text>
        <Tag color={hasLicense ? "success" : "default"}>
          {hasLicense ? t("approval.hasFinal") : t("approval.noFinal")}
        </Tag>
      </Space>

      {pending && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(22,119,255,0.06)",
            border: "1px solid rgba(22,119,255,0.2)",
          }}
        >
          <Typography.Text strong>
            {t("approval.waiting", {
              from: stageLabel(pending.fromStage),
              to: stageLabel(pending.toStage),
            })}
          </Typography.Text>
          {pending.note && (
            <div>
              <Typography.Text type="secondary">{t("approval.note", { note: pending.note })}</Typography.Text>
            </div>
          )}
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove()} disabled={!canActAsReviewer}>
              {t("common.approve")}
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => handleReject(t("approval.needDocs"))}
              disabled={!canActAsReviewer}
            >
              {t("common.reject")}
            </Button>
          </Space>
        </div>
      )}

      {order.approvalStatus !== "pending_review" && canActAsSubmitter && (
        <Form form={form} layout="vertical" onFinish={handleRequest} style={{ maxWidth: 480, marginBottom: 24 }}>
          <Form.Item
            name="toStage"
            label={t("approval.requestLabel")}
            rules={[{ required: true, message: t("approval.selectTarget") }]}
          >
            <Select placeholder={t("approval.moveTo")} options={targetOptions} />
          </Form.Item>

          <Form.Item name="note" label={t("common.note")}>
            <Input.TextArea rows={2} placeholder={t("approval.reasonPh")} />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
            {t("approval.send")}
          </Button>
        </Form>
      )}

      {order.approvalStatus !== "pending_review" && !canActAsSubmitter && (
        <Typography.Paragraph type="secondary">{t("approval.switchRole")}</Typography.Paragraph>
      )}

      <Typography.Title level={5}>{t("approval.history")}</Typography.Title>
      {order.approvalHistory.length === 0 ? (
        <Typography.Text type="secondary">{t("approval.noHistory")}</Typography.Text>
      ) : (
        <Timeline
          items={[...order.approvalHistory].reverse().map((h) => ({
            color: h.status === "approved" ? "green" : h.status === "rejected" ? "red" : "blue",
            children: (
              <div>
                <div>
                  <StatusBadge module="approvalRequest" status={h.status} />
                  {stageLabel(h.fromStage)} → {stageLabel(h.toStage)}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                  {t("approval.sentBy", { name: h.requestedBy, date: h.requestedAt })}
                  {h.reviewedBy
                    ? t("approval.reviewedBy", { name: h.reviewedBy, date: h.reviewedAt ?? "" })
                    : ""}
                </Typography.Text>
                {(h.note || h.reviewNote) && (
                  <div style={{ fontSize: ds.fontSize.caption }}>
                    {h.note && <div>{t("approval.reqLine", { note: h.note })}</div>}
                    {h.reviewNote && <div>{t("approval.revLine", { note: h.reviewNote })}</div>}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
}
