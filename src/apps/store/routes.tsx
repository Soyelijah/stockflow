import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CustomerPortal } from './pages/CustomerPortal';

export default function StoreRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CustomerPortal />} />
    </Routes>
  );
}
