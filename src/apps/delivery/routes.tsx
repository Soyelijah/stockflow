import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { DriverPWA } from "../../shared/components/DriverPWA";

export function DeliveryRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DriverPWA />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
