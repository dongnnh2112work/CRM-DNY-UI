"use client";

import { InboxOutlined } from "@ant-design/icons";
import { Button, Modal, Space, Table, Typography, Upload } from "antd";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, unknown>[]) => void;
  expectedColumns?: string[];
}

export function ExcelImportModal({ open, onClose, onImport, expectedColumns }: ExcelImportModalProps) {
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (json.length > 0) {
        setColumns(Object.keys(json[0]));
        setPreview(json.slice(0, 10));
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // prevent default upload
  }, []);

  const handleConfirm = () => {
    onImport(preview);
    setPreview([]);
    setColumns([]);
    onClose();
  };

  return (
    <Modal
      title="Nhập từ Excel"
      open={open}
      onCancel={() => { setPreview([]); setColumns([]); onClose(); }}
      width={720}
      footer={
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" disabled={preview.length === 0} onClick={handleConfirm}>
            Nhập {preview.length} dòng
          </Button>
        </Space>
      }
    >
      {preview.length === 0 ? (
        <Upload.Dragger beforeUpload={handleFile} accept=".xlsx,.xls,.csv" showUploadList={false}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Nhấn hoặc kéo thả file .xlsx / .csv vào đây</p>
          {expectedColumns && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Cột mong đợi: {expectedColumns.join(", ")}
            </Typography.Text>
          )}
        </Upload.Dragger>
      ) : (
        <>
          <Typography.Text type="secondary">
            Xem trước ({preview.length} dòng đầu):
          </Typography.Text>
          <Table
            rowKey={(_, i) => String(i)}
            dataSource={preview}
            columns={columns.map((c) => ({ title: c, dataIndex: c, key: c, ellipsis: true }))}
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
