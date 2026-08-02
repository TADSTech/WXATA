/**
 * Unit tests for Firebase auth flows
 * Requirements: 7.2, 7.6, 7.7
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from '../pages/Register';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';

// ---------------------------------------------------------------------------
// Mock the firebase module
// ---------------------------------------------------------------------------
vi.mock('../firebase', () => {
  return {
    findUserByUsername: vi.fn(),
    findUserByUid: vi.fn(),
    findCodeByCode: vi.fn(),
    createBotAccount: vi.fn(),
    sendBotVerificationEmail: vi.fn(),
    insertUser: vi.fn(),
    updateUserCode: vi.fn(),
    signInBotWithPassword: vi.fn(),
    signOutBot: vi.fn(),
    subscribeToAuth: vi.fn(() => vi.fn()),
    getCurrentUser: vi.fn(),
    listDocs: vi.fn(),
    insertExtension: vi.fn(),
    updateExtension: vi.fn(),
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
// Import the mocked firebase helpers so we can configure them per test
// ---------------------------------------------------------------------------
import {
  findUserByUsername,
  findUserByUid,
  findCodeByCode,
  createBotAccount,
  sendBotVerificationEmail,
  insertUser,
  updateUserCode,
  signInBotWithPassword,
  getCurrentUser,
} from '../firebase';

// ---------------------------------------------------------------------------
// Test: Sign-up success path
// ---------------------------------------------------------------------------
describe('Sign-up success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to verify after successful registration', async () => {
    (findUserByUsername as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    (findCodeByCode as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'code-id-1',
      used: false,
      suspended: false,
    });
    (createBotAccount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { uid: 'uid-123' },
    });
    (sendBotVerificationEmail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (insertUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (updateUserCode as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

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

    // Assert navigation to the verify page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/verify\?email=/)
      );
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
    // Email identifier → straight to Firebase sign-in
    (signInBotWithPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      { user: { uid: 'uid-123' } }
    );
    (findUserByUid as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: 'testuser',
    });

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
    // Simulate an expired/missing session. getCurrentUser() is synchronous
    // (returns auth.currentUser), so the mock must return null, not a Promise.
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      null
    );

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
