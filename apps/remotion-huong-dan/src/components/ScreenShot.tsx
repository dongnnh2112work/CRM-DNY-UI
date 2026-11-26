import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ScreenShotProps = {
  src: string;
  zoom?: number;
  focusX?: number;
  focusY?: number;
};

export const ScreenShot: React.FC<ScreenShotProps> = ({
  src,
  zoom = 1,
  focusX = 50,
  focusY = 50,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 80 },
  });

  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [1.04, 1]) * zoom;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #E0F2FE 0%, #F1F5F9 45%, #E2E8F0 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "92%",
          height: "86%",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 28px 60px rgba(15, 23, 42, 0.22)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          background: "#fff",
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: `${focusX}% ${focusY}%`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "top center",
            background: "#F8FAFC",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
