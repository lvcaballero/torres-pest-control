// Forgot-password route. Mirrors LoginPage's shell.

import { Navigate, useLocation } from "react-router-dom";
import ForgotPassword from "../components/auth/ForgotPassword";
import useAuth from "../hooks/useAuth";

function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  return (
    <div className="login-page">
      <main className="login-form-panel">
        <ForgotPassword />
      </main>
    </div>
  );
}

export default ForgotPasswordPage;
