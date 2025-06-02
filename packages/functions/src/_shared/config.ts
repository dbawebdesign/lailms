export const LOGIN_REDIRECT_URL = Deno.env.get('LOGIN_REDIRECT_URL') || 
  Deno.env.get('NEXT_PUBLIC_APP_URL') || 
  (Deno.env.get('VERCEL_URL') ? `https://${Deno.env.get('VERCEL_URL')}` : 'http://localhost:3000/'); 