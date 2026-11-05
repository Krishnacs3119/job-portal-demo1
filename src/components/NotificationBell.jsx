import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  const fetchNotifications = useCallback(async (isCancelled = () => false) => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error

      if (!isCancelled()) {
        setNotifications(data || [])
        setUnreadCount((data || []).filter((n) => !n.is_read).length)
      }
    } catch (err) {
      if (!isCancelled()) {
        console.error("Failed to load notifications:", err.message)
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const isCancelled = () => cancelled

    // Initial fetch
    fetchNotifications(isCancelled)

    // Generate a unique channel name on each effect invocation to survive StrictMode double-mount
    const channelName = `user-notifications-${user.id}-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!cancelled) {
            fetchNotifications(isCancelled)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchNotifications])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick)
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [isOpen])

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return

    try {
      setLoading(true)
      const { error } = await supabase.rpc("mark_all_notifications_as_read")
      if (error) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false)
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notif.id)

        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (err) {
        console.error("Failed to mark notification as read:", err.message)
      }
    }

    setIsOpen(false)

    if (notif.link) {
      if (notif.link.startsWith("http://") || notif.link.startsWith("https://")) {
        window.open(notif.link, "_blank", "noopener,noreferrer")
      } else {
        navigate(notif.link)
      }
    }
  }

  const formatTimestamp = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now - date) / 1000)

    if (diffSec < 60) return "Just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 rounded-full transition-transform active:scale-95"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
      >
        <motion.div
          animate={
            !shouldReduceMotion && unreadCount > 0
              ? { rotate: [0, -12, 12, -8, 8, 0] }
              : { rotate: 0 }
          }
          transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.6 }}
        >
          <Bell className="h-5 w-5 text-foreground/80 hover:text-foreground transition-colors" />
        </motion.div>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-[calc(100vw-2.5rem)] sm:w-96 max-w-sm rounded-xl border bg-card/95 backdrop-blur-md shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary font-bold">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2"
                  onClick={handleMarkAllRead}
                  disabled={loading}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Inbox className="h-8 w-8 text-muted-foreground/40" />
                  <p className="font-medium text-xs">No notifications yet</p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-[200px]">
                    We will notify you here when there are updates on your jobs or applications.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 text-left cursor-pointer hover:bg-muted/50 transition-colors ${
                      !notif.is_read ? "bg-primary/[0.04] font-medium" : "opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!notif.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 ring-4 ring-primary/20" />
                        )}
                        <span className="text-xs font-semibold leading-tight text-foreground">
                          {notif.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(notif.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="uppercase tracking-wider font-mono text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {notif.type.replace("_", " ")}
                      </span>
                      {notif.link && (
                        <span className="text-primary font-medium flex items-center gap-0.5 hover:underline">
                          View details <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
