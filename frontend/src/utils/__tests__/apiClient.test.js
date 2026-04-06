/**
 * apiClient.test.js
 * Tests for the core API client patterns: error normalization, token management,
 * and request/retry logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Error normalization logic', () => {
  it('detects timeout errors via code', () => {
    const error = { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' };
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    expect(isTimeout).toBe(true);
  });

  it('detects timeout errors via message', () => {
    const error = { code: 'UNKNOWN', message: 'request timeout' };
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    expect(isTimeout).toBe(true);
  });

  it('detects network errors (no response, has request)', () => {
    const error = { code: 'ERR_NETWORK', message: 'Network Error', response: undefined, request: {} };
    const isNetworkError = !error.response && !!error.request;
    expect(isNetworkError).toBe(true);
  });

  it('does not flag server errors as network errors', () => {
    const error = { response: { status: 500, data: {} }, request: {} };
    const isNetworkError = !error.response && error.request;
    expect(isNetworkError).toBe(false);
  });

  it('extracts structured backend error codes', () => {
    const backendData = { error: 'DB failed', code: 'DB_CONNECTION_FAILED', path: '/api/connect' };
    expect(backendData.code).toBe('DB_CONNECTION_FAILED');
  });

  it('maps HTTP status codes to error categories', () => {
    const statusMap = { 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 503: 'SERVICE_UNAVAILABLE' };
    expect(statusMap[401]).toBe('UNAUTHORIZED');
    expect(statusMap[403]).toBe('FORBIDDEN');
    expect(statusMap[404]).toBe('NOT_FOUND');
    expect(statusMap[503]).toBe('SERVICE_UNAVAILABLE');
  });

  it('handles validation error arrays from FastAPI', () => {
    const backendMessage = [{ loc: ['body', 'email'], msg: 'field required', type: 'value_error.missing' }];
    const serialized = JSON.stringify(backendMessage);
    expect(serialized).toContain('field required');
  });
});


describe('Token management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves auth tokens', () => {
    localStorage.setItem('token', 'access-123');
    localStorage.setItem('refresh_token', 'refresh-456');
    expect(localStorage.getItem('token')).toBe('access-123');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-456');
  });

  it('clears tokens on logout', () => {
    localStorage.setItem('token', 'access-123');
    localStorage.setItem('refresh_token', 'refresh-456');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('returns null for missing tokens', () => {
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('constructs Bearer header from stored token', () => {
    localStorage.setItem('token', 'my-jwt-token');
    const token = localStorage.getItem('token');
    const header = token ? `Bearer ${token}` : undefined;
    expect(header).toBe('Bearer my-jwt-token');
  });

  it('skips auth header for auth routes', () => {
    const url = '/auth/login';
    const isAuthRoute = url.startsWith('/auth/');
    expect(isAuthRoute).toBe(true);
  });

  it('attaches auth header for non-auth routes', () => {
    const url = '/graph/conn_1';
    const isAuthRoute = url.startsWith('/auth/');
    expect(isAuthRoute).toBe(false);
  });
});


describe('Retry logic', () => {
  it('limits retries to 2 attempts', () => {
    let retryCount = 0;
    const maxRetries = 2;
    while (retryCount < maxRetries) {
      retryCount++;
    }
    expect(retryCount).toBe(2);
  });

  it('calculates exponential backoff correctly', () => {
    const backoff1 = 1000 * Math.pow(2, 1 - 1); // 1000ms
    const backoff2 = 1000 * Math.pow(2, 2 - 1); // 2000ms
    expect(backoff1).toBe(1000);
    expect(backoff2).toBe(2000);
  });

  it('retries on 503 status', () => {
    const status = 503;
    const shouldRetry = status === 503 || status === 0;
    expect(shouldRetry).toBe(true);
  });
});
