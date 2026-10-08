import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"KARVO | Home, Fabrication & Construction Services",description:"Request a KARVO site visit."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
