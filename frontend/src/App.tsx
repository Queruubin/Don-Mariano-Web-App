import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

// A data router: the order form needs `useBlocker` to warn before leaving (FR-25).
const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
