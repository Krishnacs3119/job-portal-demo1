import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import RootLayout from "@/layouts/RootLayout"
import Home from "@/pages/Home"
import Jobs from "@/pages/Jobs"
import JobDetails from "@/pages/JobDetails"
import PostJob from "@/pages/PostJob"
import MyJobs from "@/pages/MyJobs"
import CompanySetup from "@/pages/CompanySetup"
import SavedJobs from "@/pages/SavedJobs"
import MyApplications from "@/pages/MyApplications"
import JobApplicants from "@/pages/JobApplicants"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import ForgotPassword from "@/pages/ForgotPassword"
import ResetPassword from "@/pages/ResetPassword"
import Onboarding from "@/pages/Onboarding"
import Dashboard from "@/pages/Dashboard"
import { ProtectedRoute, PublicOnlyRoute, OnboardingRoute, RoleRoute } from "@/components/ProtectedRoute"

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      // Public Job browsing & details
      {
        path: "jobs",
        element: <Jobs />,
      },
      {
        path: "jobs/:id",
        element: <JobDetails />,
      },

      // Candidate-only routes
      {
        path: "saved",
        element: (
          <RoleRoute allowedRoles={["candidate", "admin"]}>
            <SavedJobs />
          </RoleRoute>
        ),
      },
      {
        path: "dashboard/my-applications",
        element: (
          <RoleRoute allowedRoles={["candidate", "admin"]}>
            <MyApplications />
          </RoleRoute>
        ),
      },

      // Recruiter-only routes
      {
        path: "company/setup",
        element: (
          <RoleRoute allowedRoles={["recruiter", "admin"]}>
            <CompanySetup />
          </RoleRoute>
        ),
      },
      {
        path: "jobs/new",
        element: (
          <RoleRoute allowedRoles={["recruiter", "admin"]}>
            <PostJob />
          </RoleRoute>
        ),
      },
      {
        path: "dashboard/my-jobs",
        element: (
          <RoleRoute allowedRoles={["recruiter", "admin"]}>
            <MyJobs />
          </RoleRoute>
        ),
      },
      {
        path: "dashboard/jobs/:id/applications",
        element: (
          <RoleRoute allowedRoles={["recruiter", "admin"]}>
            <JobApplicants />
          </RoleRoute>
        ),
      },

      // Public-only Auth Routes (redirects away if already signed in)
      {
        path: "login",
        element: (
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        ),
      },
      {
        path: "signup",
        element: (
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        ),
      },

      // Password Recovery Route
      {
        path: "reset-password",
        element: <ResetPassword />,
      },

      // Role Onboarding Route (accessible only if role is NULL)
      {
        path: "onboarding",
        element: (
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        ),
      },

      // General Protected Dashboard (requires login + chosen role)
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },

      // Admin Control Panel placeholder (for Part 7)
      {
        path: "admin/control-panel",
        element: (
          <RoleRoute allowedRoles={["admin"]}>
            <div className="p-8 text-center border rounded-lg">
              <h2 className="text-xl font-bold">Admin Control Panel</h2>
              <p className="text-muted-foreground mt-2">Coming in Part 7.</p>
            </div>
          </RoleRoute>
        ),
      },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
