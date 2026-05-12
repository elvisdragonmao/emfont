/** @format */

import { RootProvider } from "fumadocs-ui/provider";
import "fumadocs-ui/style.css";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import './style.css';
const inter = Inter({
    subsets: ["latin"],
});

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className={inter.className} suppressHydrationWarning>
            <body
                style={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100vh",
                }}
            >
                <RootProvider
                    search={{
                        options: {
                            type: "static",
                            api: "/docs/search"
                        },
                    }}
                >
                    {children}
                </RootProvider>
            </body>
        </html>
    );
}
