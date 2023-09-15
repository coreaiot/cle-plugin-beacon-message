export interface IPlugin<
  Status extends {
    fields: ReadonlyArray<any>;
  },
> {
  name: string;
  version: string;
  buildin: boolean;
  jsPath: string;
  json5Path: string;
  enabled: boolean;
  debug: boolean;
  status: {
    [k in Status['fields'][number]['name'] | 'result']: string;
  };
  logger: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
    trace(...args: any[]): void;
  };
}