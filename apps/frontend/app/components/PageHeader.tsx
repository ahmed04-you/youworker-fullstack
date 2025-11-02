"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export default function PageHeader() {
  const pathname = usePathname();

  // Don't show header on home page
  if (pathname === "/") {
    return null;
  }

  return (
    <div className="page-header">
      <Image
        src="/YouWorker.ai-logo.svg"
        alt="YouWorker.ai"
        width={150}
        height={38}
        priority
      />
    </div>
  );
}
