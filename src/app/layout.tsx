import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Class Scheduler",
  description: "A free, feature-rich class schedule planner. Visualize your weekly schedule, detect conflicts, and manage multiple semesters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
