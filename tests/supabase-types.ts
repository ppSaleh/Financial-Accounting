import type {
  RegistrationCredential,
  AuthenticationCredential,
  PublicKeyCredentialFuture,
} from '../node_modules/@supabase/auth-js/dist/module/lib/webauthn.dom';

type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Verify native JSON types remain precise, including required registration fields
// and serialized extension blobs. Equality also rejects an accidental never type.
type RegistrationJSON = Assert<Equal<
  ReturnType<RegistrationCredential['toJSON']>, RegistrationResponseJSON
>>;
type AuthenticationJSON = Assert<Equal<
  ReturnType<AuthenticationCredential['toJSON']>, AuthenticationResponseJSON
>>;
type EitherJSON = Assert<Equal<
  ReturnType<PublicKeyCredentialFuture['toJSON']>,
  RegistrationResponseJSON | AuthenticationResponseJSON
>>;
