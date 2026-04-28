/**
 * Unit tests for Supabase auth flows
 * Requirements: 7.2, 7.6, 7.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from '../pages/Register';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';

// ---------------------------------------------------------------------------
// Mock the supabase module
// ---------------------------------------------------------------------------
vi.mock('../supabase', () => {
  const mockFrom = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockOnAuthStateChange = vi.fn();
  const mockSignOut = vi.fn();

  return {
    supabase: {
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
        onAuthStateChange: mockOnAuthStateChange,
        signOut: mockSignOut,
      },
      from: mockFrom,
    },
  };
});

// ---------------------------------------------------------------------------
// Mock react-router-dom's useNavigate
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Import the mocked supabase so we can configure it per test
// ---------------------------------------------------------------------------
import { supabase } from '../supabase';

// ---------------------------------------------------------------------------
// Test: Sign-up success path
// ---------------------------------------------------------------------------
describe('Sign-up success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to dashboard after successful registration', async () => {
    const mockSupabase = supabase as unknown as {
      auth: {
        signUp: ReturnType<typeof vi.fn>;
        signInWithPassword: ReturnType<typeof vi.fn>;
        onAuthStateChange: ReturnType<typeof vi.fn>;
        signOut: ReturnType<typeof vi.fn>;
      };
      from: ReturnType<typeof vi.fn>;
    };

    // Mock supabase.from() to return appropriate responses for each table call
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'user_codes') {
        // First call: select (verify code) → valid, unused code
        // Second call: update (mark used) → success
        const chain = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'code-id-1', used: false, suspended: false },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        // update().eq() should be awaitable
        chain.update.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    // Mock supabase.auth.signUp to return a user
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'uid-123' } },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
        </Routes>
      </MemoryRouter>
    );

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/registration code/i), {
      target: { value: 'VALIDCODE123456' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    // Assert navigation to dashboard
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/testuser');
    });
  });
});

// ---------------------------------------------------------------------------
// Test: Sign-in success path
// ---------------------------------------------------------------------------
describe('Sign-in success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to /dashboard/testuser after successful login', async () => {
    const mockSupabase = supabase as unknown as {
      auth: {
        signUp: ReturnType<typeof vi.fn>;
        signInWithPassword: ReturnType<typeof vi.fn>;
        onAuthStateChange: ReturnType<typeof vi.fn>;
        signOut: ReturnType<typeof vi.fn>;
      };
      from: ReturnType<typeof vi.fn>;
    };

    // Mock signInWithPassword to return a session
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'uid-123' }, session: { access_token: 'tok' } },
      error: null,
    });

    // Mock supabase.from('users').select('username').eq(...).single() → username
    mockSupabase.from.mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { username: 'testuser' },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    // Fill in email and password
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Assert navigation to /dashboard/testuser
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/testuser');
    });
  });
});

// ---------------------------------------------------------------------------
// Test: Session expiry redirect
// ---------------------------------------------------------------------------
describe('Session expiry redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when session is null', async () => {
    const mockSupabase = supabase as unknown as {
      auth: {
        signUp: ReturnType<typeof vi.fn>;
        signInWithPassword: ReturnType<typeof vi.fn>;
        onAuthStateChange: ReturnType<typeof vi.fn>;
        signOut: ReturnType<typeof vi.fn>;
      };
      from: ReturnType<typeof vi.fn>;
    };

    // Mock onAuthStateChange to immediately call the callback with null session
    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: null) => void) => {
        // Simulate session expiry: call with null session synchronously
        callback('SIGNED_OUT', null);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }
    );

    // from() is not expected to be called when session is null, but mock it anyway
    mockSupabase.from.mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard/testuser']}>
        <Routes>
          <Route path="/dashboard/:username" element={<Dashboard />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Assert redirect to /login
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
