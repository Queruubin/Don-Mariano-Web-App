import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../auth/store/authStore';
import type { Role, User } from '../auth/types/auth.types';
import { AppNav } from './components/AppNav';
import { navItemsFor } from './navigation';

function userWithRole(role: Role): User {
  return {
    id: 1,
    email: 'test@donmariano.co',
    name: 'Gloria',
    role,
    branch: role === 'super_admin' ? null : 1,
    branch_name: role === 'super_admin' ? null : 'Sede Centro',
    is_active: true,
    date_joined: '2026-01-01T00:00:00Z',
  };
}

function renderNavAs(role: Role) {
  useAuthStore.setState({ user: userWithRole(role), isAuthenticated: true });
  render(
    <MemoryRouter>
      <AppNav />
    </MemoryRouter>,
  );
  return screen.getAllByRole('link').map((link) => link.textContent);
}

describe('role-based navigation', () => {
  beforeEach(() => useAuthStore.setState({ user: null, tokens: null, isAuthenticated: false }));

  it('shows staff only orders and catalog', () => {
    expect(renderNavAs('branch_staff')).toEqual(['Domicilios', 'Catálogo']);
  });

  it('shows branch admins the users page but not branches', () => {
    expect(renderNavAs('branch_admin')).toEqual(['Domicilios', 'Catálogo', 'Usuarios']);
  });

  it('shows super admins everything', () => {
    expect(renderNavAs('super_admin')).toEqual(['Domicilios', 'Catálogo', 'Usuarios', 'Sedes']);
  });

  it('has no items without a user', () => {
    expect(navItemsFor(null)).toEqual([]);
  });
});
