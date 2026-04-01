declare module "jsonwebtoken" {
  export type Secret = string | Buffer;

  export interface SignOptions {
    expiresIn?: number;
  }

  export function sign(payload: object, secretOrPrivateKey: Secret, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: Secret): unknown;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}
