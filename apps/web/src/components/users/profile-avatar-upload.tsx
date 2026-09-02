"use client";

import { UploadOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Space, Upload } from "antd";
import { useT } from "@/lib/use-t";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatarUpload({
  avatar,
  size = 96,
  onChange,
}: {
  avatar?: string;
  size?: number;
  onChange: (next: string | undefined) => void;
}) {
  const t = useT();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Avatar size={size} src={avatar} icon={<UserOutlined />} />
      <Space direction="vertical" size={4}>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file) => {
            const dataUrl = await readFileAsDataUrl(file);
            onChange(dataUrl);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />} size="small">
            {t("profile.uploadAvatar")}
          </Button>
        </Upload>
        {avatar ? (
          <Button
            type="link"
            size="small"
            danger
            style={{ padding: 0 }}
            onClick={() => onChange(undefined)}
          >
            {t("profile.removeAvatar")}
          </Button>
        ) : null}
      </Space>
    </div>
  );
}
