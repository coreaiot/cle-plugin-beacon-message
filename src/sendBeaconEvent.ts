import { checkSum1B } from './checkSum1B';
import { getBeacons, IBinaryCommand, IGatewayResult, Plugin, Utils, addColonToMac } from '@lib';

const cmd: IBinaryCommand = {
  cmd: 0x13,
  result: b => {
    if (!b.length) return false;
    if (b[b.length - 1] !== checkSum1B(b.slice(0, b.length - 1))) return false;
    if (b[b.length - 2] !== 0x01) return false;
    return b;
  },
}

export interface IBeaconEventBody {
  mac: string; // 信标 MAC
  value: number; // 事件值
  duration?: number; // 事件发送时长 (s)。默认 5 秒
  timeout?: number; // 接口调用超时时间 (ms)。默认为 `duration * 1000` 毫秒
  ext?: [number, number, number]; // 扩展。默认 [0, 0, 0]
}

export async function sendBeaconEvent(
  self: Plugin,
  utils: Utils,
  body: IBeaconEventBody
) {
  self.status.status = 'sending beacon event';

  if (!body.mac) throw 'Beacon mac required';
  const mac: string = body.mac.toLowerCase().replace(/:/g, '');

  const beacons = getBeacons(utils);
  if (!beacons[mac]) throw `Beacon ${mac} not valid`;

  const gMac = beacons[mac].lastGateway;
  const gateways = (() => {
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
    return utils.packGatewaysByMac(locators, undefined, true);
  })();
  const gateway = gateways[addColonToMac(gMac)];
  if (!gateway) throw `Locator ${gMac} not valid`;

  const v: number = body.value;
  const s: number = body.duration || 5;
  const ext: number[] = body.ext || [0, 0, 0];
  const u8a = Buffer.alloc(11);
  u8a[0] = parseInt(mac.slice(0, 2), 16) || 0;
  u8a[1] = parseInt(mac.slice(2, 4), 16) || 0;
  u8a[2] = parseInt(mac.slice(4, 6), 16) || 0;
  u8a[3] = parseInt(mac.slice(6, 8), 16) || 0;
  u8a[4] = parseInt(mac.slice(8, 10), 16) || 0;
  u8a[5] = parseInt(mac.slice(10, 12), 16) || 0;
  u8a[6] = v;
  u8a[7] = s;
  u8a[8] = ext[0];
  u8a[9] = ext[1];
  u8a[10] = ext[2];

  const { take, timeout, catchError } = utils.modules.rxjsOperators;
  const { throwError, TimeoutError } = utils.modules.rxjs;

  const durationMs = s * 1000;
  await utils.udp
    .sendBinaryCmd(gMac, cmd, u8a)
    .pipe(
      timeout(body.timeout || durationMs),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw 'Timeout';
        }
        return throwError(err);
      }),
      take(1),
    )
    .toPromise();

  setTimeout(() => {
    self.status.status = 'idle';
  }, durationMs);
}
