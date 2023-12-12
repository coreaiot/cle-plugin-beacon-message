import { checkSum1B } from "./checkSum1B";
import { IBeacons, IBinaryCommand, IGateways, Utils } from "@lib";

const cmdSendMessage: IBinaryCommand = {
  cmd: 0xa3,
  result: b => {
    if (!b.length) return false;
    if (b[b.length - 1] !== checkSum1B(b.slice(0, b.length - 1))) return false;
    if (b[b.length - 2] !== 0x01) return 'Failed';
    return 'Success';
  },
};
const cmdStopSendMessage: IBinaryCommand = {
  cmd: 0xa4,
  result: b => {
    if (!b.length) return false;
    if (b[b.length - 1] !== checkSum1B(b.slice(0, b.length - 1))) return false;
    if (b[b.length - 2] !== 0x01) return 'Failed';
    return 'Success';
  },
};

export interface IGroupedLocator {
  mac: string;
  product: string;
  sMacs: string[];
}

export async function sendMessageM12(
  utils: Utils,
  value: number[],
  timeoutMs: number,
  locatorResponseTimeoutMs: number,
  groupedLocator: IGroupedLocator
) {
  const l = groupedLocator;

  const { take, timeout, catchError } = utils.modules.rxjsOperators;
  const { throwError, TimeoutError } = utils.modules.rxjs;

  const length = 18 + value.length + 6 * l.sMacs.length;
  const u8a = Buffer.alloc(length);
  u8a[0] = 2;
  u8a[1] = timeoutMs;
  u8a[2] = 0x80;
  u8a[16] = value.length;
  for (let i = 0; i < value.length; ++i) {
    u8a[17 + i] = value[i];
  }
  u8a[17 + value.length] = l.sMacs.length;
  for (let i = 0; i < l.sMacs.length; ++i) {
    const idx = 18 + value.length + i * 6;
    for (let j = 0; j < 6; ++j)
      u8a[idx + j] = parseInt(l.sMacs[i].slice(j * 2, j * 2 + 2), 16);
  }
  await utils.udp
    .sendBinaryCmd(l.mac, cmdSendMessage, u8a)
    .pipe(
      timeout(locatorResponseTimeoutMs),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw 'Locator response timeout.';
        }
        return throwError(err);
      }),
      take(1),
    )
    .toPromise();
}

export function stopSendMessageM12(utils: Utils, locatorMac: string) {
  return utils.udp
    .sendBinaryCmd(locatorMac, cmdStopSendMessage);
}

export function groupLocators(beacons: IBeacons, locators: IGateways, macs: string[]) {
  const ls: IGroupedLocator[] = [];
  for (const mac of macs) {
    let gMac = beacons[mac].nearestGateway;
    let best = locators[gMac];
    if (!best || !best.ip) {
      gMac = beacons[mac].lastGateway;
      best = locators[gMac];
    }
    if (!best || !best.ip) {
      continue;
    }
    let ex = ls.find(l => l.mac === gMac);
    if (!ex) {
      ex = {
        mac: gMac,
        product: best.info.realModelName,
        sMacs: [],
      };
      ls.push(ex);
    }
    if (ex.product === 'CL-GA25-P2') {
      if (ex.sMacs.length < 42) ex.sMacs.push(mac);
    } else {
      if (ex.sMacs.length < 30) ex.sMacs.push(mac);
    }
  }
  return ls;
}

