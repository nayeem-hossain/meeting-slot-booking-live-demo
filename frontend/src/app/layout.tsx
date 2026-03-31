import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../components/auth-provider";
import { AuthToolbar } from "../components/auth-toolbar";
import { AppNav } from "../components/app-nav";

export const metadata: Metadata = {
  title: "Meeting Slot Booking",
  description: "Book rooms in 15-minute increments"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <main className="appShell">
            <header className="topBar">
              <div className="brandWrap">
                <span className="brandKicker">Workspace Operations</span>
                <h1 className="brandTitle">Meeting Slot Booking</h1>
              </div>
              <div className="navRow">
                <AppNav />
              </div>
              <AuthToolbar />
            </header>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
