export type GuideStatus = "ready" | "planned";

export type UserGuide = {
  slug: string;
  title: string;
  group: string;
  status: GuideStatus;
  file: string;
};

/** Thứ tự hiển thị trên trang Hướng dẫn. `file` nằm trong document/huong-dan. */
export const USER_GUIDES: UserGuide[] = [
  { slug: "dang-nhap", title: "Đăng nhập", group: "Bắt đầu", status: "ready", file: "dang-nhap.md" },
  { slug: "tong-quan", title: "Tổng quan", group: "Hằng ngày", status: "planned", file: "tong-quan.md" },
  { slug: "khach-hang", title: "Khách hàng", group: "Hằng ngày", status: "planned", file: "khach-hang.md" },
  { slug: "don-hang", title: "Đơn hàng", group: "Hằng ngày", status: "planned", file: "don-hang.md" },
  { slug: "thanh-toan", title: "Thanh toán", group: "Tài chính", status: "planned", file: "thanh-toan.md" },
  { slug: "de-nghi-thanh-toan", title: "Đề nghị thanh toán", group: "Tài chính", status: "planned", file: "de-nghi-thanh-toan.md" },
  { slug: "luong", title: "Lương", group: "Tài chính", status: "planned", file: "luong.md" },
  { slug: "vat", title: "VAT", group: "Tài chính", status: "planned", file: "vat.md" },
  { slug: "dich-vu", title: "Dịch vụ", group: "Danh mục", status: "planned", file: "dich-vu.md" },
  { slug: "email", title: "Email", group: "Danh mục", status: "planned", file: "email.md" },
  { slug: "nguoi-dung", title: "Người dùng", group: "Quản trị", status: "planned", file: "nguoi-dung.md" },
  { slug: "phan-quyen", title: "Phân quyền", group: "Quản trị", status: "planned", file: "phan-quyen.md" },
  { slug: "cai-dat", title: "Cài đặt", group: "Quản trị", status: "planned", file: "cai-dat.md" },
  { slug: "ho-so", title: "Hồ sơ của tôi", group: "Quản trị", status: "planned", file: "ho-so.md" },
  { slug: "thong-bao", title: "Thông báo", group: "Quản trị", status: "planned", file: "thong-bao.md" },
];

export function guideBySlug(slug: string) {
  return USER_GUIDES.find((item) => item.slug === slug);
}
