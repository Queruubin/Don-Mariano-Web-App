import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './auth/components/LoginForm';
import { AuthGuard } from './auth/guards/AuthGuard';
import { Layout } from './shared/components/Layout';
import { OrderListPage } from './orders/components/OrderListPage';
import { BranchListPage } from './branches/components/BranchListPage';
import { UserListPage } from './auth/components/UserListPage';
import { CatalogPage } from './catalog/components/CatalogPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />

        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/" element={<OrderListPage />} />
            <Route path="/branches" element={<BranchListPage />} />
            <Route path="/users" element={<UserListPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
