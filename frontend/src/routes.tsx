import { Navigate, type RouteObject } from 'react-router-dom';
import { LoginForm } from './auth/components/LoginForm';
import { UserListPage } from './auth/components/UserListPage';
import { AuthGuard } from './auth/guards/AuthGuard';
import { RequireRole } from './auth/guards/RequireRole';
import { BranchListPage } from './branches/components/BranchListPage';
import { RequireBranch } from './branches/guards/RequireBranch';
import { CatalogPage } from './catalog/components/CatalogPage';
import { EditOrderPage } from './orders/components/EditOrderPage';
import { NewOrderPage } from './orders/components/NewOrderPage';
import { OrderBoardPage } from './orders/components/board/OrderBoardPage';
import { OrderDetailPage } from './orders/components/detail/OrderDetailPage';
import { OrderPrintPage } from './orders/components/print/OrderPrintPage';
import { Layout } from './shared/components/Layout';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginForm /> },
  {
    element: <AuthGuard />,
    children: [
      // Print view: no header or menu (FR-31), so the empty state links back to the app.
      {
        element: <RequireBranch standalone />,
        children: [{ path: '/domicilios/:id/imprimir', element: <OrderPrintPage /> }],
      },
      {
        element: <Layout />,
        children: [
          { path: '/', element: <Navigate to="/domicilios" replace /> },
          {
            // Branch-scoped pages (FR-2, FR-3).
            element: <RequireBranch />,
            children: [
              { path: '/domicilios', element: <OrderBoardPage /> },
              { path: '/domicilios/nuevo', element: <NewOrderPage /> },
              { path: '/domicilios/:id', element: <OrderDetailPage /> },
              { path: '/domicilios/:id/editar', element: <EditOrderPage /> },
              { path: '/catalog', element: <CatalogPage /> },
            ],
          },
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
