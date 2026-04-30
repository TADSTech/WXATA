/**
 * Property test for Register page
 * Task 5.3
 * Requirements: 2.5
 *
 * Feature: wxata-monetization, Property 4: Invalid user_code error always includes WhatsApp link
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as fc from 'fast-check';
import Register from '../pages/Register';

const WHATSAPP_LINK = 'https://wa.me/2347041029093';

// ---------------------------------------------------------------------------
// Mock supabase — always return "not found" for any user_code
// ---------------------------------------------------------------------------
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Property 4: Invalid user_code error always includes WhatsApp link
// ---------------------------------------------------------------------------
describe('Property 4: Invalid user_code error always includes WhatsApp link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('error message always contains WhatsApp link for any invalid code', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary strings as invalid codes (filter out empty)
        fc.string({ minLength: 1, maxLength: 30 }),
        async (invalidCode) => {
          const { unmount } = render(
            <MemoryRouter initialEntries={['/register']}>
              <Routes>
                <Route path="/register" element={<Register />} />
              </Routes>
            </MemoryRouter>
          );

          // Fill in the form with the invalid code
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
            target: { value: invalidCode },
          });

          fireEvent.click(screen.getByRole('button', { name: /register/i }));

          // Wait for error to appear
          await waitFor(() => {
            const errorEl = document.querySelector('.bg-red-900\\/50');
            if (!errorEl) throw new Error('Error element not found');
          }, { timeout: 3000 });

          const errorEl = document.querySelector('.bg-red-900\\/50');
          const errorText = errorEl?.textContent ?? '';
          const containsWhatsApp = errorText.includes(WHATSAPP_LINK);

          unmount();
          return containsWhatsApp;
        }
      ),
      { numRuns: 5 }
    );
  });
});
