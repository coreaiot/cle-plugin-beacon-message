import { checkSum1B } from './checkSum1B';
import { IBeacons, IBinaryCommand, Plugin, Utils, addColonToMac } from './lib';
import { getBeacons } from './lib/getBeacons';

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
  self.status.status = 'buzy';
  utils.updateStatus(self);

  if (!body.mac) throw 'Beacon mac required';
  const mac: string = body.mac.toLowerCase().replace(/:/g, '');

  const beacons = getBeacons(utils);
  if (!beacons[mac]) throw `Beacon ${mac} not valid`;

  const gMac = beacons[mac].lastGateway;
  const gateways = (() => {
    const now = new Date().getTime();
    const ts = now - utils.projectEnv.locatorLifeTime;
    const data = utils.packGatewaysByMac(utils.activeLocators, ts);
    return data;
  })();
  const gateway = gateways[addColonToMac(gMac)];
  if (!gateway) throw `Locator ${gMac} not valid`;

  const v: number = body.value;
  const s: number = body.duration || 5;
  const ext: number[] = body.ext || [0, 0, 0];
  const ab = new ArrayBuffer(11);
  const u8a = new Uint8Array(ab);
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
    .sendBinaryCmd(cmd, gMac, [gateway.ip], ab)
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
    utils.updateStatus(self);
  }, durationMs);
}
