"use client";

import { Card, Tag, Typography, theme } from "antd";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import type { Order, OrderStage } from "@/lib/types";
import { ORDER_STAGES } from "@/lib/types";
import Link from "next/link";

interface KanbanBoardProps {
  orders: Order[];
  onMove: (orderId: string, newStage: OrderStage) => boolean | void;
}

export function KanbanBoard({ orders, onMove }: KanbanBoardProps) {
  const { token } = theme.useToken();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId) return;
    const orderId = result.draggableId;
    const newStage = result.destination.droppableId as OrderStage;
    onMove(orderId, newStage);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: 16, minHeight: 500 }}>
        {ORDER_STAGES.map((stage) => {
          const stageOrders = orders.filter((o) => o.stage === stage.key);
          return (
            <Droppable droppableId={stage.key} key={stage.key}>
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
                    <Tag color={stage.color}>{stage.label}</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {stageOrders.length}
                    </Typography.Text>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {stageOrders.map((order, idx) => {
                      const fileCount = order.attachments.filter((a) => !a.deleted).length;
                      return (
                        <Draggable key={order.id} draggableId={order.id} index={idx}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <Link href={`/orders/${order.id}`} style={{ textDecoration: "none" }}>
                                <Card
                                  size="small"
                                  hoverable
                                  styles={{
                                    body: { background: token.colorBgElevated },
                                  }}
                                  style={{
                                    cursor: "grab",
                                    border: `1px solid ${token.colorBorder}`,
                                    borderRadius: token.borderRadius,
                                    background: token.colorBgElevated,
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                                    <Typography.Text strong style={{ fontSize: 13 }}>
                                      {order.orderNumber}
                                    </Typography.Text>
                                    {order.approvalStatus === "pending_review" && (
                                      <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>
                                        Duyệt
                                      </Tag>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>
                                    {order.customerName}
                                  </div>
                                  <div style={{ fontSize: 12, marginTop: 4, color: token.colorText }}>
                                    {order.serviceName}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      marginTop: 8,
                                      fontSize: 12,
                                      alignItems: "center",
                                      gap: 4,
                                      color: token.colorTextSecondary,
                                    }}
                                  >
                                    <span>{order.value.toLocaleString("vi-VN")} ₫</span>
                                    <Tag style={{ fontSize: 11 }}>{order.assignedUserName}</Tag>
                                  </div>
                                  {(fileCount > 0 || order.reviewerName) && (
                                    <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary }}>
                                      {fileCount > 0 ? `${fileCount} file` : "Chưa có file"}
                                      {" · "}Người duyệt: {order.reviewerName}
                                    </div>
                                  )}
                                </Card>
                              </Link>
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
  );
}
