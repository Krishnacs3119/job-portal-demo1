import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"
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
import RecruiterCredits from "@/pages/RecruiterCredits"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import ForgotPassword from "@/pages/ForgotPassword"
import ResetPassword from "@/pages/ResetPassword"
import Onboarding from "@/pages/Onboarding"
import Dashboard from "@/pages/Dashboard"
import AdminDashboard from "@/pages/AdminDashboard"
import { ProtectedRoute, PublicOnlyRoute, OnboardingRoute, RoleRoute, AdminRoute } from "@/components/ProtectedRoute"

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "jobs",
        element: <Jobs />,
      },
      {
        path: "jobs/:id",
        element: <JobDetails />,
      },
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
      {
        path: "dashboard/credits",
        element: (
          <RoleRoute allowedRoles={["recruiter", "admin"]}>
            <RecruiterCredits />
          </RoleRoute>
        ),
      },
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
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "onboarding",
        element: (
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },
      {
        path: "admin/control-panel",
        element: <Navigate to="/admin" replace />,
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
