// Forgot-password route. Shares LoginPage's AuthLayout frame.

import { Navigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import ForgotPassword from "../components/auth/ForgotPassword";
import useAuth from "../hooks/useAuth";

function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  return (
    <AuthLayout>
      <ForgotPassword />
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
