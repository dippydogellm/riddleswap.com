declare module './gcs-upload' {
  export function uploadToGCS(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  export function getGCSPublicUrl(storageKey: string): string;
}
