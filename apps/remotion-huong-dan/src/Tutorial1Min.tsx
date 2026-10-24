import React from "react";
import { AbsoluteFill, Sequence, Series } from "remotion";
import { Caption } from "./components/Caption";
import { ScreenShot } from "./components/ScreenShot";
import { Spotlight } from "./components/Spotlight";
import { StepRail } from "./components/StepRail";
import { TitleCard } from "./components/TitleCard";

/**
 * Preview 60s — Đăng nhập → Chờ duyệt → Tổng quan
 * FPS 30 → 1800 frames
 */
export const Tutorial1Min: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F172A" }}>
      <Series>
        {/* 0–4s Intro */}
        <Series.Sequence durationInFrames={120}>
          <TitleCard
            title="Hướng dẫn sử dụng"
            subtitle="Phút đầu: vào hệ thống và đọc Tổng quan"
            footer="Bản preview 1 phút — sẽ mở rộng full sau khi duyệt"
          />
        </Series.Sequence>

        {/* 4–12s Login overview */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="dang-nhap.png" />
            <StepRail activeIndex={0} />
            <Caption
              step="Bước 1 · Đăng nhập"
              title="Mở CRM — chọn cách vào hệ thống"
              subtitle="Google (tài khoản công ty) hoặc email + mật khẩu"
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 12–20s Highlight Google */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="dang-nhap.png" zoom={1.08} focusX={50} focusY={38} />
            <StepRail activeIndex={0} />
            <Sequence from={8}>
              <Spotlight
                x={32}
                y={28}
                width={36}
                height={10}
                label="Ưu tiên Google"
              />
            </Sequence>
            <Caption
              step="Bước 1 · Google"
              title="Bấm Đăng nhập bằng Google"
              subtitle="Dùng khi công ty cấp Gmail — nhanh và không cần nhớ mật khẩu CRM"
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 20–28s Highlight email form */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="dang-nhap.png" zoom={1.12} focusX={50} focusY={62} />
            <StepRail activeIndex={0} />
            <Sequence from={6}>
              <Spotlight
                x={31}
                y={40}
                width={38}
                height={32}
                label="Hoặc email"
              />
            </Sequence>
            <Caption
              step="Bước 1 · Email"
              title="Điền Email → Mật khẩu → Đăng nhập"
              subtitle="Sai mật khẩu thì ở lại màn này — thử lại hoặc đổi sang Google"
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 28–36s Pending approval */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="cho-duyet.png" />
            <StepRail activeIndex={1} />
            <Sequence from={10}>
              <Spotlight
                x={28}
                y={36}
                width={44}
                height={22}
                label="Chờ admin"
              />
            </Sequence>
            <Caption
              step="Bước 1b · Lần đầu Google"
              title="Tài khoản đang chờ duyệt"
              subtitle="Admin gán vai trò xong → bấm Kiểm tra lại (hoặc mở lại trang). Không cần đợi email."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 36–44s Dashboard intro */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="05-dashboard.png" />
            <StepRail activeIndex={2} />
            <Caption
              step="Bước 2 · Tổng quan"
              title="Màn đầu sau khi vào CRM"
              subtitle="Chỉ đọc số liệu — không tạo dữ liệu ở đây"
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 44–52s Highlight metric cards */}
        <Series.Sequence durationInFrames={240}>
          <AbsoluteFill>
            <ScreenShot src="05-dashboard.png" zoom={1.15} focusX={55} focusY={18} />
            <StepRail activeIndex={2} />
            <Sequence from={6}>
              <Spotlight
                x={18}
                y={10}
                width={76}
                height={16}
                label="4 thẻ số"
              />
            </Sequence>
            <Caption
              step="Bước 2 · Thẻ số"
              title="Doanh thu · Đơn · Khách · Lương"
              subtitle="Thẻ Lương chỉ hiện khi tài khoản được xem lương. Đang tải = khung chờ, không phải số 0 giả."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 52–58s Highlight lists */}
        <Series.Sequence durationInFrames={180}>
          <AbsoluteFill>
            <ScreenShot src="05-dashboard.png" zoom={1.18} focusX={50} focusY={78} />
            <StepRail activeIndex={2} />
            <Sequence from={6}>
              <Spotlight
                x={14}
                y={58}
                width={72}
                height={28}
                label="Gần đây"
              />
            </Sequence>
            <Caption
              step="Bước 2 · Danh sách"
              title="Đơn gần đây & Thanh toán sắp tới"
              subtitle="Bấm mã đơn để mở hồ sơ. Nhãn Đỏ = Quá hạn · Cam = Một phần."
            />
          </AbsoluteFill>
        </Series.Sequence>

        {/* 58–60s Outro */}
        <Series.Sequence durationInFrames={60}>
          <TitleCard
            title="Xong phút đầu"
            subtitle="Tiếp theo: Khách hàng → Đơn hàng → Thanh toán"
            footer="Duyệt style này rồi mình làm full theo clip recording của bạn"
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
