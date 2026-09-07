/**
 * webauthnClient.js
 * Browser platform authenticator client utility for WebAuthn.
 * Zero raw biometrics handled: OS & browser handle biometrics.
 */

// Helper: base64url to ArrayBuffer
export function base64urlToBuffer(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// Helper: ArrayBuffer to base64url
export function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Check if the browser and device have a suitable platform authenticator available
 * e.g., Windows Hello, Touch ID, Face ID, Android Biometric, or device PIN / Passkey
 */
export async function isPlatformAuthenticatorAvailable() {
  try {
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!available;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Perform platform authenticator enrollment (Registration)
 */
export async function createPlatformCredential(creationOptions) {
  if (!window.PublicKeyCredential) {
    throw new Error('WEBAUTHN_UNAVAILABLE');
  }

  const challenge = base64urlToBuffer(creationOptions.challenge);
  const userId = base64urlToBuffer(creationOptions.user.id);

  const excludeCredentials = (creationOptions.excludeCredentials || []).map((c) => ({
    ...c,
    id: base64urlToBuffer(c.id),
  }));

  const publicKey = {
    ...creationOptions,
    challenge,
    user: {
      ...creationOptions.user,
      id: userId,
    },
    excludeCredentials,
  };

  try {
    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) {
      throw new Error('WEBAUTHN_FAILED');
    }

    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      },
    };
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      throw new Error('WEBAUTHN_CANCELLED');
    }
    throw new Error('WEBAUTHN_FAILED');
  }
}

/**
 * Perform platform authenticator verification (Assertion)
 */
export async function getPlatformAssertion(requestOptions) {
  if (!window.PublicKeyCredential) {
    throw new Error('WEBAUTHN_UNAVAILABLE');
  }

  const challenge = base64urlToBuffer(requestOptions.challenge);

  const allowCredentials = (requestOptions.allowCredentials || []).map((c) => ({
    ...c,
    id: base64urlToBuffer(c.id),
  }));

  const publicKey = {
    ...requestOptions,
    challenge,
    allowCredentials,
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey });
    if (!assertion) {
      throw new Error('WEBAUTHN_FAILED');
    }

    return {
      id: assertion.id,
      rawId: bufferToBase64url(assertion.rawId),
      type: assertion.type,
      response: {
        authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
        clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
        signature: bufferToBase64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null,
      },
    };
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      throw new Error('WEBAUTHN_CANCELLED');
    }
    throw new Error('WEBAUTHN_FAILED');
  }
}
