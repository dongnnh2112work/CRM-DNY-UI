import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { GuideMarkdown } from "@/components/guides/guide-markdown";
import { GuideShell } from "@/components/guides/guide-shell";
import { PageHeader } from "@/components/shared/page-header";
import { guideBySlug } from "@/lib/user-guides";

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide || guide.status !== "ready") notFound();

  const filePath = path.join(process.cwd(), "document", "huong-dan", guide.file);
  const source = await readFile(filePath, "utf8");

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Hướng dẫn", href: "/huong-dan" }, { title: guide.title }]} />
      <GuideShell>
        <GuideMarkdown source={source} />
      </GuideShell>
    </>
  );
}
