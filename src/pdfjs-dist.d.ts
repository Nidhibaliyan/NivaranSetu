declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const version: string;
  export function getDocument(src: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    verbosity?: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{
          items: Array<{ str?: string; hasEOL?: boolean }>;
        }>;
      }>;
      destroy(): Promise<void>;
    }>;
    destroy(): Promise<void>;
  };
}
