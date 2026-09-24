// Sign-in route. The form itself is components/auth/Login.

import { Navigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import Login from "../components/auth/Login";
import useAuth from "../hooks/useAuth";

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  return (
    <AuthLayout>
      <Login onLogin={login} />
    </AuthLayout>
  );
}

export default LoginPage;
