import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";

type TitleCardProps = {
  brand?: string;
  title: string;
  subtitle?: string;
  footer?: string;
};

export const TitleCard: React.FC<TitleCardProps> = ({
  brand = "DNY CRM",
  title,
  subtitle,
  footer,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  const brandY = interpolate(enter, [0, 1], [-24, 0]);
  const titleY = interpolate(
    spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 100 } }),
    [0, 1],
    [28, 0],
  );
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(145deg, #0B1220 0%, #0F2744 48%, #0EA5E9 140%)",
        justifyContent: "center",
        alignItems: "center",
        padding: 64,
      }}
    >
      {/* Soft ambient shapes */}
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(56, 189, 248, 0.18)",
          filter: "blur(40px)",
          top: -80,
          right: -60,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "rgba(14, 165, 233, 0.12)",
          filter: "blur(30px)",
          bottom: -100,
          left: -40,
        }}
      />

      <div style={{ textAlign: "center", opacity, zIndex: 1, maxWidth: 900 }}>
        <div
          style={{
            transform: `translateY(${brandY}px)`,
            fontFamily,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            color: "#7DD3FC",
            marginBottom: 18,
          }}
        >
          {brand}
        </div>
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            fontFamily,
            fontSize: 56,
            fontWeight: 800,
            color: "#F8FAFC",
            lineHeight: 1.15,
            marginBottom: 16,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily,
              fontSize: 24,
              color: "#BAE6FD",
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        {footer ? (
          <div
            style={{
              marginTop: 36,
              fontFamily,
              fontSize: 16,
              color: "rgba(226, 232, 240, 0.75)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
