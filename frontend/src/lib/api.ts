/**
 * API client for the Verique backend
 */

import { VerificationResult, VerifyRequest, VerifyUrlRequest } from './types';

// Get the API base URL from environment variables or use default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Verify text content
 */
export async function verifyContent(request: VerifyRequest): Promise<VerificationResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Verification failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify content from URL
 */
export async function verifyUrl(url: string, vertical?: string): Promise<VerificationResult> {
  const request: VerifyUrlRequest = {
    url,
    vertical: vertical as any,
  };

  const response = await fetch(`${API_BASE_URL}/api/v1/verify/url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'URL verification failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Get verification status by ID
 */
export async function getVerificationStatus(verificationId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/verify/${verificationId}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
