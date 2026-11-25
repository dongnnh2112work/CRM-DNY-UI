"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Alert, Button, Modal, Space, Table, Typography, Upload } from "antd";
import { useState, useCallback } from "react";
import { ds } from "@/lib/design-tokens";
import { isLegacyXls, parseCsv, rowsFromXlsx } from "@/lib/spreadsheet";
import { tableIndexColumn } from "@/lib/table-index-column";
import { useT } from "@/lib/use-t";

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, unknown>[]) => void | Promise<void>;
  expectedColumns?: string[];
}

export function ExcelImportModal({ open, onClose, onImport, expectedColumns }: ExcelImportModalProps) {
  const t = useT();
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const preview = allRows.slice(0, 10);

  const handleFile = useCallback(
    (file: File) => {
      setReadError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        void (async () => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(buffer);
            if (isLegacyXls(file.name, bytes)) {
              setReadError(t("import.xlsUnsupported"));
              return;
            }
            const json = file.name.toLowerCase().endsWith(".csv")
              ? parseCsv(new TextDecoder().decode(bytes))
              : await rowsFromXlsx(buffer);
            if (json.length > 0) {
              setColumns(Object.keys(json[0]));
              setAllRows(json);
            } else {
              setReadError(t("import.readFailed"));
            }
          } catch {
            setReadError(t("import.readFailed"));
          }
        })();
      };
      reader.readAsArrayBuffer(file);
      return false;
    },
    [t],
  );

  const reset = () => {
    setAllRows([]);
    setColumns([]);
    setReadError(null);
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      await onImport(allRows);
      reset();
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title={t("import.title")}
      open={open}
      onCancel={() => {
        reset();
        onClose();
      }}
      width={720}
      footer={
        <Space>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="primary" disabled={allRows.length === 0} loading={importing} onClick={() => void handleConfirm()}>
            {t("import.rows", { count: allRows.length })}
          </Button>
        </Space>
      }
    >
      {readError ? <Alert type="error" showIcon style={{ marginBottom: 12 }} title={readError} /> : null}
      {allRows.length === 0 ? (
        <Upload.Dragger beforeUpload={handleFile} accept=".xlsx,.csv" showUploadList={false}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{t("import.drop")}</p>
          {expectedColumns && (
            <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
              {t("import.expected", { cols: expectedColumns.join(", ") })}
            </Typography.Text>
          )}
        </Upload.Dragger>
      ) : (
        <>
          <Typography.Text type="secondary">
            {t("import.preview", { count: Math.min(10, allRows.length) })}
            {allRows.length > 10 ? ` · ${t("import.totalRows", { count: allRows.length })}` : null}
          </Typography.Text>
          <Table
            rowKey={(_, i) => String(i)}
            dataSource={preview}
            columns={[
              tableIndexColumn<Record<string, unknown>>(),
              ...columns.map((c) => ({ title: c, dataIndex: c, key: c, ellipsis: true })),
            ]}
            size="small"
            pagination={false}
            scroll={{ x: true }}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Modal>
  );
}
