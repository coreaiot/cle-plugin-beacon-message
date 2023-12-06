import { IGatewayResult, Plugin, Utils, getBeacons } from "@lib";
import { sendMessageM0 } from "./sendMessageM0";
import { IGroupedLocator, sendMessageM12, groupLocators } from "./sendMessageM12";

export interface IMessageBody {
  macs?: string[]; // 信标 MAC（留空为广播至所有 M0 信标）
  timeout?: number; // 全局超时时间（秒）（留空时 M0 信标为 10 秒，M1，M2 信标为 3 秒）
  timeoutM0?: number; // M0 信标超时时间（秒）（留空时使用全局超时时间）
  timeoutM12?: number; // M1，M2 信标超时时间（秒）（留空时使用全局超时时间）
  sendDurationM0?: number; // M0 信标发送时间（秒）（留空时为 5 秒）
  beaconResponseDurationM12?: number; // M1, M2 信标回复时间（秒）（留空时为 3 秒）
  locator?: string; // 指定基站发送。（IP 或 MAC）（留空时使用最近信号最好的基站）
  bufferSize?: number;// 分包长度（字节）（不大于 200）（留空时为 200）
  value: number[]; // 消息内容
}

let _beaconRequestId = 10;
function getBeaconRequestId() {
  const id = _beaconRequestId;
  ++_beaconRequestId;
  if (_beaconRequestId > 0xff) _beaconRequestId = 0;
  return id;
}

export async function sendMessage(
  self: Plugin,
  utils: Utils,
  obj: IMessageBody,
) {
  self.status.status = 'sending message';
  utils.updateStatus(self);

  const m0: string[] = [];
  const m12: string[] = [];
  let sendDurationM0 = 5;
  let timeoutM0 = 10;
  let timeoutM12 = 5;
  let beaconResponseDurationM12 = 3;
  let value: number[] = [];
  let bufferSize = 200;

  if (obj.timeout && typeof obj.timeout === 'number') {
    timeoutM0 = obj.timeout;
    timeoutM12 = obj.timeout;
  }

  if (obj.timeoutM0 && typeof obj.timeoutM0 === 'number')
    timeoutM0 = obj.timeoutM0;

  if (obj.timeoutM12 && typeof obj.timeoutM12 === 'number')
    timeoutM12 = obj.timeoutM12;

  if (obj.beaconResponseDurationM12 && typeof obj.beaconResponseDurationM12 === 'number')
    beaconResponseDurationM12 = obj.beaconResponseDurationM12;

  if (obj.sendDurationM0 && typeof obj.sendDurationM0 === 'number')
    sendDurationM0 = obj.sendDurationM0;

  if (obj.bufferSize && typeof obj.bufferSize === 'number')
    bufferSize = obj.bufferSize;

  if (obj.value !== undefined) {
    if (typeof obj.value === 'string')
      value = Array.from(Buffer.from(obj.value));
    else if (Array.isArray(obj.value)) {
      if (obj.value.some(v => typeof v !== 'number'))
        throw 'property `value` has to be a valid string or an array of numbers';
      value = obj.value;
    } else
      throw 'property `value` has to be a valid string or an array of numbers';
  }

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

  let done: string[] = [];

  if (obj.macs && Array.isArray(obj.macs) && obj.macs.length) {
    for (const m of obj.macs) {
      const mac = m.replace(/:/g, '').toLowerCase();
      if (!beacons[mac] || !beacons[mac].userData[0]) throw 'beacon not found';
      if (beacons[mac].userData[0].method) m12.push(mac);
      else m0.push(mac);
    }

    if (m0.length > 1)
      throw 'property `macs` can only have one method-0 beacon.';

    // env.sendingMsg = true;
    let resM0: string[] = [];
    let m0ts;
    if (m0.length) {
      if (sendDurationM0 >= timeoutM0)
        throw 'property `sendDurationM0` has to be less than property `timeoutM0`';
      const mac = m0[0];
      const [locatorMac, locator] = (() => {
        if (obj.locator) {
          if (/([0-9]+\.){3}[0-9]+/.test(obj.locator)) {
            const ip = obj.locator;
            const locator = Object.entries(locators).find(([mac, v]) => v.ip === ip);
            if (!locator) {
              throw 'locator `' + obj.locator + '` not found.';
            }
            return locator;
          } else {
            const mac = obj.locator.replace(/:/g, '').toLowerCase();
            const locator = locators[mac];
            if (!locator) {
              throw 'locator `' + obj.locator + '` not found.';
            }
            if (!locator.ip) {
              throw 'locator `' + obj.locator + '` offline.';
            }
            return [mac, locator];
          }
        }
        let locatorMac = beacons[mac].nearestGateway;
        let locator = locators[locatorMac];
        if (!locator || !locator.ip) {
          locatorMac = beacons[mac].lastGateway;
          locator = locators[locatorMac];
        }
        if (!locator || !locator.ip) {
          console.log(locator)
          throw 'locator `' + locatorMac + '` offline.';
        }
        return [locatorMac, locator];
      })();
      resM0 = await sendMessageM0Item(self, utils, mac, locatorMac, obj.value, sendDurationM0, timeoutM0, 2000);
      m0ts = new Date().getTime();
    }

    if (m0.length && m12.length) {
      const end = m0ts + timeoutM0 + 1000;
      let ts = new Date().getTime();
      while (ts < end) {
        await new Promise(r => setTimeout(r, 1000));
        ts = new Date().getTime();
      }
    }

    let resM12: string[] = [];
    if (m12.length) {
      const gls = (() => {
        if (obj.locator) {
          if (/([0-9]+\.){3}[0-9]+/.test(obj.locator)) {
            const ip = obj.locator;
            const locator = Object.entries(locators).find(([mac, v]) => v.ip === ip);
            if (!locator) {
              throw 'locator `' + obj.locator + '` not found.';
            }
            const res: IGroupedLocator = {
              mac: locator[0],
              product: '',
              sMacs: m12,
            }
            return [res];
          } else {
            const mac = obj.locator.replace(/:/g, '').toLowerCase();
            const locator = locators[mac];
            if (!locator) {
              throw 'locator `' + obj.locator + '` not found.';
            }
            if (!locator.ip) {
              throw 'locator `' + obj.locator + '` offline.';
            }
            const res: IGroupedLocator = {
              mac,
              product: '',
              sMacs: m12,
            }
            return [res];
          }
        }

        return groupLocators(beacons, locators, m12);
      })();
      console.log('gls', gls);
      const results = await Promise.all(
        gls.map(gl => sendMessageM12Item(self, utils, gl, value, bufferSize, timeoutM12, beaconResponseDurationM12, 2000))
      );
      resM12 = results.flat();
    }

    done = [...resM0, ...resM12];
  } else {
    if (sendDurationM0 >= timeoutM0)
      throw 'property `sendDurationM0` has to be less than property `timeoutM0`';

    done = await sendMessageM0Item(self, utils, undefined, undefined, obj.value, sendDurationM0, timeoutM0, 2000);
  }
  self.status.status = 'idle';
  utils.updateStatus(self);
  return { beacons: done };
}


async function sendMessageM12Item(
  self: Plugin,
  utils: Utils,
  gl: IGroupedLocator,
  value: number[],
  bufferSizeM12: number,
  timeoutM12: number,
  beaconResponseDurationM12: number,
  locatorResponseTimeoutMs: number,
) {
  if (self.debug) {
    self.logger.debug(`[sendMessage ${gl.sMacs.join()}] start by locator ${gl.mac}`);
  }

  const numberOfPackets = Math.ceil(value.length / bufferSizeM12);
  const beaconRequestId = getBeaconRequestId();
  let done = gl.sMacs;
  for (let idx = 0; idx < numberOfPackets; ++idx) {
    const data = value.slice(idx * bufferSizeM12, (idx + 1) * bufferSizeM12);

    const timeoutMS = beaconResponseDurationM12 * 1000;
    const v = idx
      ? [
        beaconRequestId,
        idx,
        numberOfPackets,
        0x00,
        0x64,
        timeoutMS >> 8,
        timeoutMS & 0xff,
        ...data,
      ]
      : [
        beaconRequestId,
        idx,
        numberOfPackets,
        0x00,
        0x64,
        timeoutMS >> 8,
        timeoutMS & 0xff,
        0x03,
        value.length >> 8,
        value.length & 0xff,
        ...data,
      ];

    const step = (idx + 1) + '/' + numberOfPackets;
    if (self.debug) {
      self.logger.debug(`[sendMessage ${done.join()}] sending m12 message ${step}`);
    }
    await sendMessageM12(utils, v, timeoutM12, locatorResponseTimeoutMs, 'start', gl);
    if (self.debug) {
      self.logger.debug(`[sendMessage ${done.join()}] waiting for response ${step}`);
    }
    const res = await new Promise<Set<string>>(async (r, rr) => {
      const ok = new Set<string>();
      const cb = (beacon_mac, buffer) => {
        if (
          buffer[1] === beaconRequestId &&
          buffer[2] === idx &&
          !buffer[3] && done.includes(beacon_mac)
        ) {
          ok.add(beacon_mac);
          if (ok.size === done.length) {
            r(ok);
            utils.ee.off('beacon-response', cb);
          }
        }
      };
      utils.ee.on('beacon-response', cb);
      setTimeout(() => {
        if (ok.size === done.length) return;
        r(ok);
        utils.ee.off('beacon-response', cb);
      }, timeoutM12 * 1000);
    });
    const arr = Array.from(res);
    if (self.debug) {
      self.logger.debug(`[sendMessage ${done.join()}] ${arr.join()} ${step} done`);
    }
    done = done.filter(x => arr.includes(x));
  }

  return done;
}

async function sendMessageM0Item(
  self: Plugin,
  utils: Utils,
  mac: string,
  locatorMac: string,
  value: string | number[],
  sendDurationM0: number,
  timeoutM0: number,
  locatorResponseTimeoutMs: number,
) {
  const tag = mac || 'all m0';
  if (self.debug) {
    self.logger.debug(`[sendMessage ${tag}] start by ${locatorMac ? 'locator ' + locatorMac : 'all locators'}`);
    self.logger.debug(`[sendMessage ${tag}] sending m0 message`);
  }
  await sendMessageM0(
    utils,
    mac || '010203040506',
    locatorMac,
    value,
    sendDurationM0,
    locatorResponseTimeoutMs,
  );

  if (self.debug) {
    self.logger.debug(`[sendMessage ${tag}] waiting for response`);
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
    self.logger.debug(`[sendMessage ${tag}] done`);
  }

  return Array.from(res);
}
