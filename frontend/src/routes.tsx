import { Navigate, type RouteObject } from 'react-router-dom';
import { LoginForm } from './auth/components/LoginForm';
import { UserListPage } from './auth/components/UserListPage';
import { AuthGuard } from './auth/guards/AuthGuard';
import { RequireRole } from './auth/guards/RequireRole';
import { BranchListPage } from './branches/components/BranchListPage';
import { CatalogPage } from './catalog/components/CatalogPage';
import { EditOrderPage } from './orders/components/EditOrderPage';
import { NewOrderPage } from './orders/components/NewOrderPage';
import { OrderListPage } from './orders/components/OrderListPage';
import { Layout } from './shared/components/Layout';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginForm /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Navigate to="/domicilios" replace /> },
          { path: '/domicilios', element: <OrderListPage /> },
          { path: '/domicilios/nuevo', element: <NewOrderPage /> },
          { path: '/domicilios/:id/editar', element: <EditOrderPage /> },
          { path: '/catalog', element: <CatalogPage /> },
          {
            element: <RequireRole roles={['super_admin', 'branch_admin']} />,
            children: [{ path: '/users', element: <UserListPage /> }],
          },
          {
            element: <RequireRole roles={['super_admin']} />,
            children: [{ path: '/branches', element: <BranchListPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/domicilios" replace /> },
];
