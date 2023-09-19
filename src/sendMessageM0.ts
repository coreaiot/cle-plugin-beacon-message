import { checkSum1B } from "./checkSum1B";
import { IBinaryCommand, Utils } from "./lib";

const cmdMsgLong: IBinaryCommand = {
  cmd: 0x17,
  result: b => {
    if (!b.length) return false;
    if (b[b.length - 1] !== checkSum1B(b.slice(0, b.length - 1))) return false;
    if (b[b.length - 2] !== 0x01) return false;
    return b;
  },
};

export async function sendMessageM0(
  utils: Utils,
  mac: string,
  locatorMac: string,
  locatorAddrs: string[],
  value: string | number[],
  sendDurationM0: number,
  locatorResponseTimeoutMs: number,
) {
  const v = typeof value === 'string' ? Array.from(Buffer.from(value)) : value;

  if (v.length > 63) throw 'The max length of value is 63';

  const ab = new ArrayBuffer(7 + v.length);
  const u8a = new Uint8Array(ab);
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
  await utils.udp
    .sendBinaryCmd(cmdMsgLong, locatorMac, locatorAddrs, ab)
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
}