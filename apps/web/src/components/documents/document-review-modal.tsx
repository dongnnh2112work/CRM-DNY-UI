"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Image, Modal, Space, Spin, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { ds } from "@/lib/design-tokens";
import { apiErrorMessage } from "@/lib/http/message";
import { formatFileBytes } from "@/modules/documents/map-to-ui";
import {
  downloadDocument,
  loadDocumentPreview,
  officeEmbedUrl,
  type FilePreviewKind,
} from "@/modules/documents/open-file";
import { useT } from "@/lib/use-t";

export function DocumentReviewModal({
  open,
  documentId,
  fileName,
  fileSize,
  onClose,
}: {
  open: boolean;
  documentId?: string;
  fileName?: string;
  fileSize?: number;
  onClose: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [forcedId, setForcedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<FilePreviewKind>("file");
  const [deferred, setDeferred] = useState(false);
  const title = fileName || t("docs.review");
  const forceInline = Boolean(documentId && forcedId === documentId);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSrc(null);
    setRemoteUrl(null);
    setDeferred(false);
    void loadDocumentPreview(documentId, {
      fileName,
      size: fileSize,
      force: forceInline,
    })
      .then((loaded) => {
        if (cancelled) return;
        setSrc(loaded.src);
        setRemoteUrl(loaded.info.downloadUrl);
        setKind(loaded.kind);
        setDeferred(loaded.deferred);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, t("docs.reviewFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId, fileName, fileSize, forceInline, t]);

  const save = async () => {
    if (!documentId) return;
    setDownloading(true);
    try {
      await downloadDocument(documentId, fileName || "file");
    } catch (err) {
      setError(apiErrorMessage(err, t("docs.reviewFailed")));
    } finally {
      setDownloading(false);
    }
  };

  const frameStyle = {
    width: "100%" as const,
    height: "70vh",
    border: 0,
    background: token.colorBgContainer,
  };

  const preview = (() => {
    if (loading) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: ds.fontSize.caption }}>
            {t("docs.reviewLoading")}
          </Typography.Paragraph>
        </div>
      );
    }
    if (error) {
      return <Alert type="error" showIcon message={error} />;
    }
    if (deferred) {
      return (
        <Alert
          type="warning"
          showIcon
          message={t("docs.reviewLarge", { size: formatFileBytes(fileSize) })}
          action={
            <Space wrap>
              <Button icon={<DownloadOutlined />} loading={downloading} onClick={() => void save()}>
                {t("docs.download")}
              </Button>
              <Button type="primary" onClick={() => setForcedId(documentId ?? null)}>
                {t("docs.reviewAnyway")}
              </Button>
            </Space>
          }
        />
      );
    }
    if (!src) {
      return <Typography.Text type="secondary">{t("docs.reviewFailed")}</Typography.Text>;
    }
    if (kind === "pdf") {
      return <iframe title={title} src={src} style={frameStyle} />;
    }
    if (kind === "image") {
      return (
        <div style={{ textAlign: "center", maxHeight: "70vh", overflow: "auto", padding: 8 }}>
          <Image src={src} alt={title} preview={false} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
        </div>
      );
    }
    if (kind === "office" && remoteUrl) {
      return (
        <div>
          <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.caption, marginBottom: 8 }}>
            {t("docs.reviewOfficeHint")}
          </Typography.Paragraph>
          <iframe title={title} src={officeEmbedUrl(remoteUrl)} style={frameStyle} />
        </div>
      );
    }
    return (
      <Alert
        type="info"
        showIcon
        message={t("docs.reviewDownloadHint")}
        action={
          <Button type="primary" icon={<DownloadOutlined />} loading={downloading} onClick={() => void save()}>
            {t("docs.download")}
          </Button>
        }
      />
    );
  })();

  const wide = !deferred && (kind === "pdf" || kind === "image" || kind === "office");

  return (
    <Modal
      title={t("docs.reviewTitle", { name: title })}
      open={open}
      onCancel={onClose}
      width={wide ? 960 : 560}
      centered
      destroyOnHidden
      footer={
        <Space>
          <Button
            icon={<DownloadOutlined />}
            loading={downloading}
            disabled={loading || !documentId}
            onClick={() => void save()}
          >
            {t("docs.download")}
          </Button>
          {remoteUrl ? (
            <Button href={remoteUrl} target="_blank" rel="noopener noreferrer">
              {t("docs.openNewTab")}
            </Button>
          ) : null}
          <Button type="primary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </Space>
      }
    >
      {preview}
    </Modal>
  );
}
