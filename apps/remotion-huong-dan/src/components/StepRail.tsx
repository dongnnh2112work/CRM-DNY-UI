import React from "react";
import { AbsoluteFill } from "remotion";
import { fontFamily } from "../fonts";

const STEPS = ["Đăng nhập", "Chờ duyệt", "Tổng quan"];

type StepRailProps = {
  activeIndex: number;
};

export const StepRail: React.FC<StepRailProps> = ({ activeIndex }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 36,
          display: "flex",
          gap: 10,
          background: "rgba(15, 23, 42, 0.72)",
          padding: "10px 14px",
          borderRadius: 999,
          backdropFilter: "blur(8px)",
        }}
      >
        {STEPS.map((label, i) => {
          const active = i === activeIndex;
          const done = i < activeIndex;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: active ? "#0EA5E9" : "transparent",
                color: active || done ? "#F8FAFC" : "#94A3B8",
                fontFamily,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active
                    ? "rgba(255,255,255,0.25)"
                    : done
                      ? "#22C55E"
                      : "rgba(148,163,184,0.25)",
                  fontSize: 11,
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
