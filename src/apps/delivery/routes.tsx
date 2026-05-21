import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { DriverPortal } from './pages/DriverPortal';
import { RoleGuard } from '@/src/shared/ui/RoleGuard';

export default function DeliveryRoutes() {
  return (
    <Routes>
      <Route element={<RoleGuard allowedRoles={['driver', 'admin', 'owner', 'logistics']} />}>
        <Route path="/" element={<DriverPortal />} />
      </Route>
    </Routes>
  );
}
