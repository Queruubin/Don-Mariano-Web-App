import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginForm } from './auth/components/LoginForm';
import { UserListPage } from './auth/components/UserListPage';
import { AuthGuard } from './auth/guards/AuthGuard';
import { RequireRole } from './auth/guards/RequireRole';
import { BranchListPage } from './branches/components/BranchListPage';
import { CatalogPage } from './catalog/components/CatalogPage';
import { OrderListPage } from './orders/components/OrderListPage';
import { Layout } from './shared/components/Layout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />

        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/" element={<OrderListPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route element={<RequireRole roles={['super_admin', 'branch_admin']} />}>
              <Route path="/users" element={<UserListPage />} />
            </Route>
            <Route element={<RequireRole roles={['super_admin']} />}>
              <Route path="/branches" element={<BranchListPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
