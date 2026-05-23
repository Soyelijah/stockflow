import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { DeliveryMap } from "../../shared/components/DeliveryMap";

export function DeliveryRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DeliveryMap />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
