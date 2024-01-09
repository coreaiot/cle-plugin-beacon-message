import { checkSum1B } from "./checkSum1B";
import { IBinaryCommand, Utils, IGatewayResult } from "@lib";

const cmdMsg: IBinaryCommand = {
  cmd: 0x16,
  result: b => {
    if (!b.length) return false;
    if (b[b.length - 1] !== checkSum1B(b.slice(0, b.length - 1))) return false;
    if (b[b.length - 2] !== 0x01) return false;
    return b;
  },
};

export async function sendMessageM0Old(
  utils: Utils,
  mac: string,
  locatorMac: string,
  value: string | number[],
  sendDurationM0: number,
  locatorResponseTimeoutMs: number,
) {
  const v = typeof value === 'string' ? Array.from(Buffer.from(value)) : value;

  if (v.length > 21) throw 'The max length of value is 21';

  const u8a = Buffer.alloc(28);
  u8a[0] = sendDurationM0;
  u8a[1] = parseInt(mac.slice(0, 2), 16) || 0;
  u8a[2] = parseInt(mac.slice(2, 4), 16) || 0;
  u8a[3] = parseInt(mac.slice(4, 6), 16) || 0;
  u8a[4] = parseInt(mac.slice(6, 8), 16) || 0;
  u8a[5] = parseInt(mac.slice(8, 10), 16) || 0;
  u8a[6] = parseInt(mac.slice(10, 12), 16) || 0;

  for (let i = 0; i < v.length; i++) u8a[7 + i] = v[i];

  const { take, timeout, catchError } = utils.modules.rxjsOperators;
  const { throwError, TimeoutError } = utils.modules.rxjs;

  if (locatorMac) {
    await utils.udp
      .sendBinaryCmd(locatorMac, cmdMsg, u8a)
      .pipe(
        timeout(locatorResponseTimeoutMs),
        catchError(err => {
          if (err instanceof TimeoutError) {
            throw 'locator response timeout.';
          }
          return throwError(err);
        }),
        take(1),
      )
      .toPromise();
  } else {
    const locators = (() => {
      const locators: IGatewayResult[] = [];
      const now = new Date().getTime();
      const ts = now - utils.projectEnv.locatorLifeTime;
      const buf = utils.ca.getLocatorsBuffer(ts);
      if (buf.length > 5) {
        const bsize = buf.readUint16LE(3);
        const n = (buf.length - 5) / bsize;
        for (let i = 0; i < n; ++i) {
          const l = utils.parseLocatorResult(buf, i * bsize + 5, ts);
          locators.push(l);
        }
      }
      return locators;
    })();

    try {
      await Promise.all(locators.map(l => utils.udp
        .sendBinaryCmd(l.mac, cmdMsg, u8a)
        .pipe(
          timeout(locatorResponseTimeoutMs),
          catchError(err => {
            if (err instanceof TimeoutError) {
              throw 'locator response timeout.';
            }
            return throwError(err);
          }),
          take(1),
        )
        .toPromise()
      ));
    } catch { }
  }
}
