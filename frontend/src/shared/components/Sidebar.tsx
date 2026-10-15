import { useAuthStore } from '../../auth/store/authStore';

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold">Don Mariano</h2>
        <p className="text-xs text-gray-400 mt-1">Gestión de Pedidos</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <a href="/" className="block px-3 py-2 rounded hover:bg-gray-800 transition-colors">
          📋 Pedidos
        </a>

        {user?.role === 'super_admin' && (
          <>
            <a href="/branches" className="block px-3 py-2 rounded hover:bg-gray-800 transition-colors">
              🏪 Sedes
            </a>
            <a href="/users" className="block px-3 py-2 rounded hover:bg-gray-800 transition-colors">
              👥 Usuarios
            </a>
            <a href="/catalog" className="block px-3 py-2 rounded hover:bg-gray-800 transition-colors">
              📦 Catálogo
            </a>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-gray-400">
              {user?.role === 'super_admin' ? 'Administrador' : user?.branch_name}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}
