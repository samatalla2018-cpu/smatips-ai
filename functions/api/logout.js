import { jsonResponse } from '../_utils.js';

export async function onRequestPost() {
  return jsonResponse(
    { success: true },
    200,
    { 'Set-Cookie': 'smatrips_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' }
  );
}
