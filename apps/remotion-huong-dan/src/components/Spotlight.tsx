import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";

type SpotlightProps = {
  /** Percent of frame width (0-100) */
  x: number;
  /** Percent of frame height (0-100) */
  y: number;
  width: number;
  height: number;
  label?: string;
  pulse?: boolean;
};

export const Spotlight: React.FC<SpotlightProps> = ({
  x,
  y,
  width,
  height,
  label,
  pulse = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140 },
  });

  const pulseScale = pulse
    ? interpolate(Math.sin(frame / 8), [-1, 1], [1, 1.03])
    : 1;

  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.92, 1]) * pulseScale;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Dim everything except hole — approximated with border glow box */}
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: `${width}%`,
          height: `${height}%`,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          opacity,
          borderRadius: 16,
          border: "3px solid #38BDF8",
          boxShadow:
            "0 0 0 9999px rgba(15, 23, 42, 0.45), 0 0 28px rgba(56, 189, 248, 0.55)",
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(x + width + 1.5, 72)}%`,
            top: `${y}%`,
            opacity,
            background: "#0EA5E9",
            color: "white",
            fontFamily,
            fontSize: 16,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 999,
            boxShadow: "0 10px 24px rgba(14, 165, 233, 0.35)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
