import { useEffect, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth";
import PageLoadingSpinner from "@/components/common/feedback/PageLoadingSpinner";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, login } = useAuth();
  const isExplicitlyLoggedOut = sessionStorage.getItem("weaver_logged_out") === "true";

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isExplicitlyLoggedOut) {
      login();
    }
  }, [isLoading, isAuthenticated, isExplicitlyLoggedOut, login]);

  if (isLoading) {
    return <PageLoadingSpinner />;
  }

  if (!isAuthenticated) {
    const handleLogin = () => {
      sessionStorage.removeItem("weaver_logged_out");
      login();
    };

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
          p: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {isExplicitlyLoggedOut ? "You have been signed out" : "Authentication Required"}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 400 }}>
          {isExplicitlyLoggedOut
            ? "Your session has ended. Click below to sign back in."
            : "You need to be signed in to access this resource. Redirecting to Keycloak..."}
        </Typography>
        <Button variant="contained" color="primary" onClick={handleLogin} sx={{ mt: 1 }}>
          Sign In with Keycloak
        </Button>
      </Box>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
          p: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, color: "error.main" }}>
          Access Denied
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 400 }}>
          You do not have the required role ({requiredRole}) to view this page.
        </Typography>
      </Box>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
