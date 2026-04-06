/**
 * ErrorBoundary.test.jsx
 * Tests for the React Error Boundary component.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Suppress React's error boundary console.error noise during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// A component that throws during render
function ThrowingComponent({ shouldThrow = true }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div data-testid="child">All good</div>;
}

// A normal component
function GoodComponent() {
  return <div data-testid="child">Hello world</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello world');
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in this section.')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('renders custom fallback when provided as a component', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom error UI');
  });

  it('renders custom fallback when provided as a render function', () => {
    render(
      <ErrorBoundary fallback={(error, reset) => (
        <div>
          <p data-testid="error-msg">{error.message}</p>
          <button onClick={reset}>Reset</button>
        </div>
      )}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-msg')).toHaveTextContent('Test explosion');
  });

  it('calls onError callback when a child throws', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('resets error state when "Try again" is clicked', () => {
    // Use a controlled throw: first render throws, second doesn't
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('Boom');
      return <div data-testid="recovered">Recovered!</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in this section.')).toBeInTheDocument();

    // Stop throwing and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    // Force re-render after state reset
    rerender(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('recovered')).toHaveTextContent('Recovered!');
  });
});
