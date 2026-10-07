import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BUYUR Growth & Sales", template: "%s · BUYUR" },
  description: "BUYUR internal Growth + Sales OS",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#faf6ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-lg !border !border-border !bg-card !text-foreground !shadow-lg !font-sans",
              description: "!text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
