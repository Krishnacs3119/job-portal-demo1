import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from public.profiles
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        console.error("Error fetching profile:", error)
        return null
      }
      setProfile(data)
      return data
    } catch (err) {
      console.error("Unexpected error fetching profile:", err)
      return null
    }
  }

  // Initial session check and auth change listener
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user || null)
          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id)
          }
        }
      } catch (err) {
        console.error("Error checking auth session:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return

        setSession(currentSession)
        setUser(currentSession?.user || null)

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Login with Password:
  // Primary path: Supabase Edge Function 'login'
  // Fallback path: Database RPC functions (check_account_lock, record_failed_login, reset_login_attempts)
  const loginWithPassword = async ({ email, password, captchaToken }) => {
    const normalizedEmail = (email || "").trim().toLowerCase()

    try {
      // 1. Attempt via Edge Function if deployed
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("login", {
        body: { email: normalizedEmail, password, captchaToken },
      })

      // If Edge Function responded successfully with a session
      if (!edgeError && edgeData?.session) {
        const { error: sessionError } = await supabase.auth.setSession(edgeData.session)
        if (sessionError) return { error: { message: sessionError.message } }
        const userProfile = await fetchProfile(edgeData.user.id)
        return { data: { user: edgeData.user, session: edgeData.session, profile: userProfile } }
      }

      // If Edge Function returned a specific lockout or auth rejection
      if (edgeError && edgeError.context) {
        try {
          const body = await edgeError.context.json()
          if (body?.error) {
            return {
              error: {
                message: body.error,
                isLocked: Boolean(body.isLocked),
                remainingMinutes: body.remainingMinutes || null,
              },
            }
          }
        } catch (_) {}
      }

      // 2. Database RPC Fallback (runs if Edge Function is not deployed or fails)
      // Check if email is currently locked in login_attempts
      const { data: lockStatus } = await supabase.rpc("check_account_lock", {
        target_email: normalizedEmail,
      })

      if (lockStatus?.is_locked) {
        return {
          error: {
            message: lockStatus.error,
            isLocked: true,
            remainingMinutes: lockStatus.remaining_minutes,
          },
        }
      }

      // Attempt sign-in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (authError) {
        // Record failed attempt in database
        const { data: failResult } = await supabase.rpc("record_failed_login", {
          target_email: normalizedEmail,
        })

        if (failResult?.is_locked) {
          return {
            error: {
              message: failResult.error,
              isLocked: true,
              remainingMinutes: failResult.remaining_minutes || 15,
            },
          }
        }

        return {
          error: {
            message: "Invalid email or password",
            attemptsLeft: failResult?.attempts_left,
          },
        }
      }

      // Sign-in successful: reset failed counter
      await supabase.rpc("reset_login_attempts", {
        target_email: normalizedEmail,
      })

      const userProfile = await fetchProfile(authData.user.id)
      return { data: { user: authData.user, session: authData.session, profile: userProfile } }
    } catch (err) {
      return { error: { message: err.message || "An unexpected error occurred during login" } }
    }
  }

  // Sign up with Email + Password + Full Name
  const signUpWithPassword = async ({ email, password, fullName, captchaToken }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        captchaToken: captchaToken || undefined,
      },
    })
    return { data, error }
  }

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    return { data, error }
  }

  // Request password reset email
  const resetPasswordForEmail = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  // Update password and immediately unlock account (Edge Function + Database RPC fallback)
  const updatePasswordAndUnlock = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error

    // Try unlock via Edge function
    try {
      await supabase.functions.invoke("unlock")
    } catch (_) {}

    // Fallback: Clear database lockout record directly via RPC
    const targetEmail = data.user?.email || user?.email
    if (targetEmail) {
      await supabase.rpc("reset_login_attempts", {
        target_email: targetEmail,
      })
    }

    if (data.user?.id) {
      await fetchProfile(data.user.id)
    }

    return data
  }

  // Set initial role (Candidate / Recruiter) via Postgres SECURITY DEFINER function
  const setInitialRole = async (newRole) => {
    const { error } = await supabase.rpc("set_initial_role", {
      new_role: newRole,
    })
    if (error) throw error

    if (user?.id) {
      await fetchProfile(user.id)
    }
  }

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  const value = {
    user,
    session,
    profile,
    loading,
    refreshProfile: () => fetchProfile(user?.id),
    loginWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    resetPasswordForEmail,
    updatePasswordAndUnlock,
    setInitialRole,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
