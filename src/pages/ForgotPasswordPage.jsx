// Forgot-password route. Shares LoginPage's shell and card design.

import { Navigate, useLocation } from "react-router-dom";
import ForgotPassword from "../components/auth/ForgotPassword";
import useAuth from "../hooks/useAuth";

function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  // Same shell as LoginPage: ForgotPassword renders the full card itself.
  return (
    <div className="standalone-login-page">
      <ForgotPassword />
    </div>
  );
}

export default ForgotPasswordPage;
