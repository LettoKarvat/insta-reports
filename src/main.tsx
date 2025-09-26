import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HumanCheck from './pages/HumanCheck';
import Login from './pages/Login';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/human-check" element={<HumanCheck />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/human-check" replace />} />
        <Route path="*" element={<Navigate to="/human-check" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);