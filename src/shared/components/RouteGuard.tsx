import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Forbidden } from "./Forbidden";

interface RouteGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RouteGuard({ allowedRoles, children }: RouteGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
      </div>
    );
  }

  // If profile is not loaded or null, treat as unauthorized (Forbidden)
  if (!profile) {
    return <Forbidden />;
  }

  // Owner always bypasses all checks
  if (profile.role === "owner") {
    return <>{children}</>;
  }

  // If the user's role is not allowed, show Forbidden
  if (!allowedRoles.includes(profile.role)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
