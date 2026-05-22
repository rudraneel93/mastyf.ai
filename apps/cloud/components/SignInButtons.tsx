'use client';

import { signIn } from 'next-auth/react';

type Props = {
  callbackUrl?: string;
};

export function SignInButtons({ callbackUrl = '/dashboard' }: Props) {
  return (
    <div className="signin-buttons">
      <button
        type="button"
        className="btn btn-google"
        onClick={() => signIn('google', { callbackUrl })}
      >
        Continue with Google
      </button>
      <button
        type="button"
        className="btn btn-github"
        onClick={() => signIn('github', { callbackUrl })}
      >
        Continue with GitHub
      </button>
    </div>
  );
}
