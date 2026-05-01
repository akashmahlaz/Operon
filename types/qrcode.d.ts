declare module "qrcode" {
  export interface QRCodeToStringOptions {
    type?: "terminal" | "utf8" | "svg";
    [key: string]: unknown;
  }

  export function toString(
    text: string,
    options?: QRCodeToStringOptions,
  ): Promise<string>;
}
