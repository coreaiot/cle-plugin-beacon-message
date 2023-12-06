import { Utils, Plugin, getBeacons, IGatewayResult } from "@lib";
import { sendMessageM0 } from "./sendMessageM0";
import { sendMessageM0Old } from "./sendMessageM0Old";

export interface IMsgBody {
  mac?: string; // 信标 MAC（留空为广播至所有信标）
  duration?: [number, number] // 基站下发时长和等待周期
  value: number[]; // 消息内容
}

export async function sendBeaconMsg(
  self: Plugin,
  utils: Utils,
  obj: IMsgBody,
  long: boolean,
) {
  self.status.status = long ?  'sending beacon msgLong' : 'sending beacon msg';
  utils.updateStatus(self);

  let mac: string;
  let gMac: string;
  let sendDurationM0 = 5;
  let timeoutM0 = 10;

  if (obj.duration) {
    if (obj.duration[0] > 0) sendDurationM0 = obj.duration[0];
    if (obj.duration[1] > 0) timeoutM0 = obj.duration[1];
  }

  if (obj.mac) {
    mac = obj.mac.replace(/:/g, '');
    const beacons = getBeacons(utils);
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
      return utils.packGatewaysByMac(locators, undefined, true);
    })();
    if (!beacons[mac]) throw 'beacon not found';
    const locatorMac = (() => {
      let locatorMac = beacons[mac].nearestGateway;
      let locator = locators[locatorMac];
      if (!locator || !locator.ip) {
        locatorMac = beacons[mac].lastGateway;
        locator = locators[locatorMac];
      }
      if (!locator || !locator.ip) {
        throw 'locator `' + locatorMac + '` offline.';
      }
      return locatorMac;
    })();
    gMac = locatorMac;
  }

  const v: number[] = obj.value || [];

  const maxLength = long ? 63 : 21;
  if (v.length > maxLength) throw `The max length of value is ${maxLength}`;

  const done: string[] = await sendMessageItem(self, utils, mac, gMac, obj.value, sendDurationM0, timeoutM0, 2000, long);

  self.status.status = 'idle';
  utils.updateStatus(self);
  return { beacons: done };
}

async function sendMessageItem(
  self: Plugin,
  utils: Utils,
  mac: string,
  locatorMac: string,
  value: string | number[],
  sendDurationM0: number,
  timeoutM0: number,
  locatorResponseTimeoutMs: number,
  long: boolean,
) {
  const prefix = long ? 'sendMsgLong' : 'sendMsg';
  const tag = mac || 'all m0';
  if (self.debug) {
    self.logger.debug(`[${prefix} ${tag}] start by ${locatorMac ? 'locator ' + locatorMac : 'all locators'}`);
    self.logger.debug(`[${prefix} ${tag}] sending m0 message`);
  }

  const fn = long ? sendMessageM0 : sendMessageM0Old;
  await fn(
    utils,
    mac || '010203040506',
    locatorMac,
    value,
    sendDurationM0,
    locatorResponseTimeoutMs,
  );

  if (self.debug) {
    self.logger.debug(`[${prefix} ${tag}] waiting for response`);
  }

  const res = await new Promise<Set<string>>(async (r, rr) => {
    const ok = new Set<string>();
    const cb = (beacon_mac, buffer) => {
      ok.add(beacon_mac);
      if (mac === beacon_mac) {
        r(ok);
        utils.ee.off('beacon-response', cb);
      }
    };
    utils.ee.on('beacon-response', cb);
    setTimeout(() => {
      r(ok);
      utils.ee.off('beacon-response', cb);
    }, timeoutM0 * 1000);
  });

  if (self.debug) {
    self.logger.debug(`[${prefix} ${tag}] done`);
  }

  return Array.from(res);
}