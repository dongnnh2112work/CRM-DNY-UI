import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";

type CaptionProps = {
  title: string;
  subtitle?: string;
  step?: string;
};

export const Caption: React.FC<CaptionProps> = ({ title, subtitle, step }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const y = interpolate(enter, [0, 1], [36, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        padding: "0 48px 40px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px)`,
          opacity,
          maxWidth: 920,
          background: "rgba(15, 23, 42, 0.88)",
          borderRadius: 18,
          padding: "18px 24px",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.28)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {step ? (
          <div
            style={{
              fontFamily,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "#93C5FD",
              marginBottom: 6,
            }}
          >
            {step}
          </div>
        ) : null}
        <div
          style={{
            fontFamily,
            fontSize: 28,
            fontWeight: 700,
            color: "#F8FAFC",
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily,
              fontSize: 18,
              color: "#CBD5E1",
              marginTop: 8,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
