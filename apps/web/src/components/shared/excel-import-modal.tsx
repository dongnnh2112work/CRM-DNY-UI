"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Button, Modal, Space, Table, Typography, Upload } from "antd";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { ds } from "@/lib/design-tokens";
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
  const preview = allRows.slice(0, 10);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (json.length > 0) {
        setColumns(Object.keys(json[0]));
        setAllRows(json);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  }, []);

  const reset = () => {
    setAllRows([]);
    setColumns([]);
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
      {allRows.length === 0 ? (
        <Upload.Dragger beforeUpload={handleFile} accept=".xlsx,.xls,.csv" showUploadList={false}>
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
