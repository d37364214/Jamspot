// api/types/api.d.ts
import { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';

export interface CustomApiRequest extends IncomingMessage {
  query: { [key: string]: string | string[] | undefined };
  body: any;
  cookies: { [key: string]: string };
  headers: IncomingHttpHeaders;
  user?: {
    id: string;
    email: string;
    role?: string;
    // ...
  };
}

export interface CustomApiResponse extends ServerResponse {
  status(statusCode: number): CustomApiResponse;
  json(data: any): CustomApiResponse;
  send(data: any): CustomApiResponse;
  setHeader(name: string, value: string | string[]): CustomApiResponse;
}
