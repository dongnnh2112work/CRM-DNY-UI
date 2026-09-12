/**
 * Capture every current CRM route with an on-image index + function label.
 * Run: node apps/web/document/ui-screenshots/_capture.mjs
 * Requires: npx playwright, and AuthGate ui-shot bypass (localStorage dyn-ui-shot=1).
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = process.env.UI_SHOT_BASE ?? "http://localhost:3001";

const SCREENS = [
  {
    index: "01",
    file: "01-login.png",
    route: "/login",
    title: "Đăng nhập",
    fn: "Đăng nhập email/mật khẩu hoặc Google OAuth",
    public: true,
  },
  {
    index: "02",
    file: "02-pending-approval.png",
    route: "/pending-approval?uiShot=1",
    title: "Chờ duyệt tài khoản",
    fn: "User Google/mới chưa có role — chờ admin gán quyền",
    public: true,
  },
  {
    index: "03",
    file: "03-auth-callback.png",
    route: "/auth/callback",
    title: "OAuth callback",
    fn: "Nhận token từ Google rồi chuyển vào hệ thống",
    public: true,
  },
  {
    index: "04",
    file: "04-auth-callback-error.png",
    route: "/auth/callback?error=access_denied&error_description=Khong%20the%20dang%20nhap%20Google",
    title: "OAuth callback — lỗi",
    fn: "Hiển thị lỗi đăng nhập Google và quay về login",
    public: true,
  },
  {
    index: "05",
    file: "05-dashboard.png",
    route: "/dashboard",
    title: "Dashboard",
    fn: "Tổng quan KPI: đơn, khách, doanh thu, cảnh báo",
  },
  {
    index: "06",
    file: "06-orders.png",
    route: "/orders",
    title: "Danh sách đơn hàng",
    fn: "Tìm, lọc, theo dõi tiến độ đơn dịch vụ",
  },
  {
    index: "07",
    file: "07-orders-new.png",
    route: "/orders/new",
    title: "Tạo đơn hàng",
    fn: "Tạo đơn mới: khách, dịch vụ, phụ trách, giai đoạn",
  },
  {
    index: "08",
    file: "08-order-detail.png",
    route: "/orders/o1",
    title: "Chi tiết đơn hàng",
    fn: "Hồ sơ đơn: giai đoạn, tài liệu, công nợ, chi phí",
  },
  {
    index: "09",
    file: "09-customers.png",
    route: "/customers",
    title: "Danh sách khách hàng",
    fn: "Quản lý khách, trạng thái, tìm kiếm, import Excel",
  },
  {
    index: "10",
    file: "10-customers-new.png",
    route: "/customers/new",
    title: "Tạo khách hàng",
    fn: "Nhập hồ sơ khách mới (tên, liên hệ, công ty, MST)",
  },
  {
    index: "11",
    file: "11-customer-detail.png",
    route: "/customers/c1",
    title: "Hồ sơ khách hàng",
    fn: "Chi tiết khách, đơn liên quan, cập nhật trạng thái",
  },
  {
    index: "12",
    file: "12-payments.png",
    route: "/payments",
    title: "Thanh toán / công nợ",
    fn: "Theo dõi đợt thanh toán, quá hạn, đã thu",
  },
  {
    index: "13",
    file: "13-payment-detail.png",
    route: "/payments/pay1",
    title: "Chi tiết thanh toán",
    fn: "Các đợt thu của một đơn: thêm đợt, đánh dấu đã thu",
  },
  {
    index: "14",
    file: "14-expense-approvals.png",
    route: "/expense-approvals",
    title: "Duyệt đề nghị thanh toán",
    fn: "Reviewer duyệt/từ chối chi phí gắn đơn",
  },
  {
    index: "15",
    file: "15-payroll.png",
    route: "/payroll",
    title: "Bảng lương",
    fn: "Tổng hợp lương / hoa hồng theo nhân sự",
  },
  {
    index: "16",
    file: "16-payroll-user.png",
    route: "/payroll/u3",
    title: "Chi tiết lương nhân viên",
    fn: "Phiếu lương một user: đơn, hoa hồng, kỳ lương",
  },
  {
    index: "17",
    file: "17-vat.png",
    route: "/vat",
    title: "Hóa đơn VAT",
    fn: "Danh sách hóa đơn VAT và hạn xuất",
  },
  {
    index: "18",
    file: "18-vat-new.png",
    route: "/vat/new",
    title: "Tạo hóa đơn VAT",
    fn: "Lập hóa đơn VAT gắn đơn / khách",
  },
  {
    index: "19",
    file: "19-services.png",
    route: "/services",
    title: "Danh mục dịch vụ",
    fn: "Catalog dịch vụ pháp lý: giá, thời gian, trạng thái",
  },
  {
    index: "20",
    file: "20-services-new.png",
    route: "/services/new",
    title: "Tạo dịch vụ",
    fn: "Thêm dịch vụ mới vào catalog",
  },
  {
    index: "21",
    file: "21-service-detail.png",
    route: "/services/s1",
    title: "Chi tiết dịch vụ",
    fn: "Sửa thông tin / lưu trữ dịch vụ",
  },
  {
    index: "22",
    file: "22-emails.png",
    route: "/emails",
    title: "Email",
    fn: "Danh sách email: nháp, lên lịch, đã gửi, thất bại",
  },
  {
    index: "23",
    file: "23-emails-new.png",
    route: "/emails/new",
    title: "Soạn email",
    fn: "Tạo / gửi / lên lịch email tới khách",
  },
  {
    index: "24",
    file: "24-users.png",
    route: "/users",
    title: "Người dùng & phân quyền",
    fn: "Danh sách user, vai trò, ma trận quyền trang",
  },
  {
    index: "25",
    file: "25-config.png",
    route: "/config",
    title: "Cài đặt hệ thống",
    fn: "Ngôn ngữ, giao diện, nhắc hạn VAT, phiên bản",
  },
  {
    index: "26",
    file: "26-profile.png",
    route: "/profile",
    title: "Hồ sơ cá nhân",
    fn: "Thông tin tài khoản, avatar, đổi mật khẩu",
  },
  {
    index: "27",
    file: "27-notifications.png",
    route: "/notifications",
    title: "Thông báo",
    fn: "Hộp thông báo nội bộ / nhắc việc",
  },
];

function bannerLabel(screen) {
  return `${screen.index}  ·  ${screen.title}  ·  ${screen.route.split("?")[0]}  ·  ${screen.fn}`;
}

async function stampBanner(page, label) {
  await page.evaluate((text) => {
    const old = document.getElementById("ui-shot-banner");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "ui-shot-banner";
    el.textContent = text;
    Object.assign(el.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "2147483647",
      background: "linear-gradient(90deg, #111827 0%, #1d4ed8 100%)",
      color: "#fff",
      padding: "10px 18px",
      font: "600 14px/1.45 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      letterSpacing: "0.01em",
      boxShadow: "0 6px 20px rgba(0,0,0,.28)",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(el);
    document.querySelector("nextjs-portal")?.remove();
  }, label);
}

async function waitSettled(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(400);
  await page
    .waitForFunction(
      () => {
        const shell = document.querySelector(".nt-page-shell");
        if (!shell) return true;
        const hasSkeleton = Boolean(shell.querySelector(".ant-skeleton"));
        const hasContent = Boolean(
          shell.querySelector("table, form, .ant-card, .ant-statistic, h1, h2, h3, h4"),
        );
        return hasContent || !hasSkeleton;
      },
      { timeout: 12_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("dyn-ui-shot", "1");
  });

  const rows = [];
  for (const screen of SCREENS) {
    const url = `${BASE}${screen.route}`;
    console.log("→", screen.index, screen.route);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitSettled(page);
    await stampBanner(page, bannerLabel(screen));
    await page.waitForTimeout(150);
    const dest = path.join(OUT, screen.file);
    await page.screenshot({ path: dest, fullPage: false });
    rows.push({
      index: screen.index,
      file: screen.file,
      route: screen.route.split("?")[0],
      title: screen.title,
      function: screen.fn,
    });
  }

  await browser.close();

  const md = [
    "# Chỉ mục màn hình UI — DNY CRM",
    "",
    "Chụp trên `http://localhost:3001`, viewport 1440×900.",
    "Mỗi ảnh có banner: **index · tên màn · route · chức năng**.",
    "",
    "| # | File | Route | Màn hình | Chức năng |",
    "|---|------|-------|----------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.index} | [${r.file}](./${r.file}) | \`${r.route}\` | ${r.title} | ${r.function} |`,
    ),
    "",
  ].join("\n");

  await writeFile(path.join(OUT, "INDEX.md"), md, "utf8");
  await writeFile(path.join(OUT, "index.json"), JSON.stringify(rows, null, 2), "utf8");
  console.log("done", rows.length, "screens →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
