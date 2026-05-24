import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CustomerPortal } from "../../shared/components/CustomerPortal";

export function StoreRoutes() {
  return (
    <Routes>
      <Route path="/cliente" element={<CustomerPortal />} />
      <Route path="/cliente/*" element={<CustomerPortal />} />
      <Route path="*" element={<Navigate to="/cliente" replace />} />
    </Routes>
  );
}
