// Type definitions for Deno Edge Functions

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): Promise<void>;
  export interface ServeInit {
    port?: number;
    hostname?: string;
    onListen?: (params: { hostname: string; port: number }) => void;
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'npm:youtube-transcript' {
  export class YoutubeTranscript {
    static fetchTranscript(videoId: string, options?: any): Promise<any[]>;
  }
}

declare module 'https://esm.sh/pdf.mjs' {
  export function getDocument(options: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNum: number): Promise<{
        getTextContent(): Promise<{
          items: Array<{ str: string }>;
        }>;
      }>;
    }>;
  };
}

// Global Deno definitions
declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    
    const env: Env;
  }
}

// Make sure fetch is properly typed for Deno environment
declare global {
  interface RequestInit {
    signal?: AbortSignal;
    headers?: Record<string, string> | Headers;
  }
} 