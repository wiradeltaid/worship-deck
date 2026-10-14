import 'react';

declare global {
  const __APP_VERSION__: string;
}

declare module 'react' {
  interface VideoHTMLAttributes<T> {
    defaultMuted?: boolean;
  }
}
