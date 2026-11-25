"use client";

import { HolderOutlined } from "@ant-design/icons";
import { Card, Tag, Tooltip, Typography, theme } from "antd";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { StatusBadge } from "@/components/shared/status-badge";
import { ZaloGroupLink } from "@/components/orders/zalo-group-link";
import { countLabel } from "@/lib/count-label";
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";
import { entityDisplayName, getOrderLicenseExpirySummary, licenseWarnMonthsForOrder, serviceDisplayName } from "@/lib/order-helpers";
import { isOrderListOverdue } from "@/lib/overdue-highlight";
import { siblingOrders } from "@/lib/order-group";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { useServices } from "@/lib/services-store";
import type { Order, OrderStage } from "@/lib/types";
import Link from "next/link";
import { useT } from "@/lib/use-t";

interface KanbanBoardProps {
  orders: Order[];
  /** Full catalog for counting sibling services on the same contract. */
  groupOrders?: Order[];
  onMove: (orderId: string, newStage: OrderStage) => boolean | void | Promise<boolean | void>;
}

export function KanbanBoard({ orders, groupOrders, onMove }: KanbanBoardProps) {
  const t = useT();
  const { token } = theme.useToken();
  const { stageOptions } = useOrderStatusConfig();
  const { services } = useServices();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId) return;
    const orderId = result.draggableId;
    const newStage = result.destination.droppableId as OrderStage;
    onMove(orderId, newStage);
  };

  return (
    <div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: 16,
            minHeight: 500,
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
          }}
        >
          {stageOptions.map((stage) => {
            const stageOrders = orders.filter((o) => o.stage === stage.value);
            return (
              <Droppable droppableId={stage.value} key={stage.value}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      minWidth: 260,
                      width: 260,
                      background: snapshot.isDraggingOver ? token.colorPrimaryBg : token.colorFillQuaternary,
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: token.borderRadiusLG,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "4px 8px" }}>
                      <StatusBadge module="orderStage" status={stage.value} />
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                        {stageOrders.length}
                      </Typography.Text>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      {stageOrders.map((order, idx) => {
                        const fileCount = order.attachments.filter((a) => !a.deleted).length;
                        const groupSize = siblingOrders(groupOrders ?? orders, order).length;
                        const overdue = isOrderListOverdue({
                          stage: order.stage,
                          deadline: order.deadline,
                          needsVat: order.needsVat,
                          vatIssueDeadline: order.vatIssueDeadline,
                          licenseTone: getOrderLicenseExpirySummary(
                            order,
                            licenseWarnMonthsForOrder(order, services),
                          ).tone,
                        });
                        return (
                          <Draggable
                            key={order.id}
                            draggableId={order.id}
                            index={idx}
                            isDragDisabled={order.stage === "cancelled"}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  borderRadius: token.borderRadius,
                                  cursor: order.stage === "cancelled" ? "default" : "grab",
                                }}
                              >
                                <Card
                                  size="small"
                                  hoverable
                                  styles={{
                                    body: {
                                      background: token.colorBgElevated,
                                      padding: 10,
                                      // outer 8 + padding 2 ≈ concentric with column radius
                                      borderRadius: Math.max(0, token.borderRadiusLG - 8),
                                    },
                                  }}
                                  style={{
                                    border: `1px solid ${overdue ? ds.danger : token.colorBorder}`,
                                    borderRadius: token.borderRadius,
                                    background: token.colorBgElevated,
                                    boxShadow: overdue ? `inset 3px 0 0 ${ds.danger}` : undefined,
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                    <Tooltip title={t("order.dragHandle")}>
                                      <span
                                        aria-hidden
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: 28,
                                          minHeight: 36,
                                          borderRadius: token.borderRadiusSM,
                                          border: `1px dashed ${token.colorPrimary}`,
                                          background: token.colorPrimaryBg,
                                          color: token.colorPrimary,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <HolderOutlined />
                                      </span>
                                    </Tooltip>
                                    <Link
                                      href={`/orders/${order.id}`}
                                      style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                        <Typography.Text strong style={{ fontSize: ds.fontSize.caption }}>
                                          {order.orderNumber}
                                          {overdue ? (
                                            <Tag color="error" style={{ marginLeft: 6 }}>
                                              {t("common.overdue")}
                                            </Tag>
                                          ) : null}
                                        </Typography.Text>
                                        {groupSize > 1 ? (
                                          <Tag style={{ marginInlineEnd: 0 }}>
                                            {t("order.groupTag", { count: groupSize })}
                                          </Tag>
                                        ) : null}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: ds.fontSize.caption,
                                          color: token.colorTextSecondary,
                                          marginTop: 4,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                        title={entityDisplayName(order.customerName)}
                                      >
                                        {entityDisplayName(order.customerName)}
                                      </div>
                                      <Tooltip title={serviceDisplayName(order, services)}>
                                        <div
                                          style={{
                                            fontSize: ds.fontSize.caption,
                                            marginTop: 4,
                                            color: token.colorText,
                                            whiteSpace: "normal",
                                            overflowWrap: "anywhere",
                                          }}
                                        >
                                          {serviceDisplayName(order, services)}
                                        </div>
                                      </Tooltip>
                                      {order.zaloGroupUrl ? (
                                        <div style={{ marginTop: 6 }}>
                                          <ZaloGroupLink url={order.zaloGroupUrl} variant="tag" />
                                        </div>
                                      ) : null}
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          marginTop: 8,
                                          fontSize: ds.fontSize.caption,
                                          alignItems: "center",
                                          gap: 8,
                                          color: token.colorTextSecondary,
                                          minWidth: 0,
                                        }}
                                      >
                                        <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                                          {formatVndDisplay(order.value)}
                                        </span>
                                        <Tooltip title={entityDisplayName(order.assignedUserName)}>
                                          <Tag
                                            style={{
                                              fontSize: ds.fontSize.caption,
                                              marginInlineEnd: 0,
                                              maxWidth: "100%",
                                              height: "auto",
                                              whiteSpace: "normal",
                                              overflowWrap: "anywhere",
                                            }}
                                          >
                                            {entityDisplayName(order.assignedUserName)}
                                          </Tag>
                                        </Tooltip>
                                      </div>
                                      {fileCount > 0 ? (
                                        <div
                                          style={{
                                            marginTop: 6,
                                            fontSize: ds.fontSize.caption,
                                            color: token.colorTextTertiary,
                                          }}
                                        >
                                          {countLabel(
                                            fileCount,
                                            t("order.fileCountOne"),
                                            t("order.fileCount", { count: fileCount }),
                                          )}
                                        </div>
                                      ) : null}
                                    </Link>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
      <Typography.Text
        type="secondary"
        style={{ display: "block", padding: "0 16px 16px", fontSize: ds.fontSize.caption }}
      >
        {t("order.swipeHint")}
      </Typography.Text>
    </div>
  );
}
