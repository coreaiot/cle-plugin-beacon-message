import { Context } from "koa";

export function parseHttpRequestBody<T>(ctx: Context) {
  return (ctx.request as any).body;
}
