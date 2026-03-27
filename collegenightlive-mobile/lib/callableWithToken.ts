/**
 * Call Firebase callable functions with an explicit ID token.
 * Use this when the SDK's httpsCallable() does not attach auth in React Native.
 */

const REGION = 'us-central1';
const PROJECT_ID = 'college-bars-live';

function getCallableUrl(name: string): string {
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}

export interface CallableError {
  message: string;
  status?: string;
  code?: string;
}

export class CallableAuthError extends Error {
  constructor(
    message: string,
    public readonly status?: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'CallableAuthError';
  }
}

/**
 * Invoke a callable function with the given ID token and payload.
 * Throws CallableAuthError (or Error with message) on failure.
 */
export async function callCallableWithToken<T, R>(
  functionName: string,
  idToken: string,
  data: T,
): Promise<R> {
  const url = getCallableUrl(functionName);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  let json: { result?: R; error?: { message?: string; status?: string } };
  try {
    json = (await res.json()) as { result?: R; error?: { message?: string; status?: string } };
  } catch {
    throw new CallableAuthError(`Request failed with status ${res.status}`, String(res.status));
  }

  if (json.error) {
    const msg = json.error.message ?? 'Request failed';
    const status = json.error.status;
    throw new CallableAuthError(msg, status, status);
  }

  if (res.status !== 200) {
    const errMsg =
      json.error && typeof json.error === 'object' && 'message' in json.error
        ? String((json.error as { message?: string }).message)
        : `Request failed with status ${res.status}`;
    throw new CallableAuthError(errMsg, String(res.status));
  }

  return json.result as R;
}
