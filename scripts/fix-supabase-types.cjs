const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// Supabase 2.116.0 uses its legacy fallback response type for native toJSON().
// Select the native registration/authentication JSON type by response shape.
const before = 'toJSON(): T;';
const after = "toJSON(): Extract<ReturnType<PublicKeyCredential['toJSON']>, { response: T extends RegistrationResponseJSON ? { attestationObject: string } : { signature: string } }>;";

for (const build of ['module', 'main']) {
  const path = join(__dirname, '..', 'node_modules', '@supabase', 'auth-js', 'dist', build, 'lib', 'webauthn.dom.d.ts');
  const text = readFileSync(path, 'utf8');
  if (text.includes(after)) continue;
  if (text.split(before).length !== 2) {
    throw new Error(`Supabase declarations changed; review or remove the patch: ${path}`);
  }
  writeFileSync(path, text.replace(before, after));
}
