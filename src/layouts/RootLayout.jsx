import { Outlet } from "react-router-dom"
import Navbar from "@/components/Navbar"

export default function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        Job Portal &copy; {new Date().getFullYear()} - Built with React & Supabase
      </footer>
    </div>
  )
}
