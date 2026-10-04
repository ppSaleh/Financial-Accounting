const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

// Repair Supabase's legacy WebAuthn return type without disabling library checks.
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
