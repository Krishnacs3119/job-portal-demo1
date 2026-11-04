import { useState } from "react"
import { Megaphone, Send } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminAnnouncement() {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [link, setLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!title.trim()) {
      setErrorMsg("Announcement title is required.")
      return
    }

    if (!message.trim()) {
      setErrorMsg("Announcement message is required.")
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc("broadcast_admin_announcement", {
        p_title: title.trim(),
        p_message: message.trim(),
        p_link: link.trim() || null,
      })

      if (error) throw error

      setSuccessMsg(`Announcement broadcast successfully to ${data ?? 0} registered user(s).`)
      setTitle("")
      setMessage("")
      setLink("")
    } catch (err) {
      setErrorMsg(err.message || "Failed to broadcast announcement.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Platform Broadcast Announcement</CardTitle>
        </div>
        <CardDescription>
          Compose and send an in-app announcement notification to every registered user on the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-emerald-600 bg-emerald-50 text-emerald-900">
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Announcement Title</Label>
            <Input
              id="announcement-title"
              placeholder="e.g. Platform Maintenance Notice or New Features Live"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcement-link">Target Route / Link (Optional)</Label>
            <Input
              id="announcement-link"
              placeholder="e.g. /jobs or https://status.example.com"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcement-message">Announcement Message</Label>
            <Textarea
              id="announcement-message"
              placeholder="Enter announcement details to display in the user's notification feed..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {loading ? "Broadcasting..." : "Broadcast to All Users"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
