import { IGatewayResult, Plugin, Utils, getBeacons } from "@lib";
import { sendMessageM0 } from "./sendMessageM0";
import { IGroupedLocator, sendMessageM12, stopSendMessageM12 } from "./sendMessageM12";

export interface IMessageBatchBody {
  timeout?: number; // 全局超时时间（秒）（留空时 M0 信标为 10 秒，M1，M2 信标为 3 秒）
  timeoutM0?: number; // M0 信标超时时间（秒）（留空时使用全局超时时间）
  timeoutM12?: number; // M1，M2 信标超时时间（秒）（留空时使用全局超时时间）
  sendDurationM0?: number; // M0 信标发送时间（秒）（留空时为 5 秒）
  bufferSizeM12?: number; // M1，M2 分包长度（字节）（不大于 200）（留空时为 200）
  beaconResponseDurationM12?: number; // M1, M2 信标回复时间（秒）（留空时为 3 秒）
  locatorResponseTimeout?: number; // 基站回复超时时间（秒）（留空时为 2 秒）
  messages: Array<{
    mac: string; // 信标 MAC
    value: string | number[]; // 消息内容
  }>;
}

export async function sendMessageBatch(
  self: Plugin,
  utils: Utils,
  obj: IMessageBatchBody,
) {
  self.status.status = 'batch sending message';

  let sendDurationM0 = 5;
  let timeoutM0 = 10;
  let timeoutM12 = 3;
  let beaconResponseDurationM12 = 3;
  let bufferSize = 200;
  let locatorResponseTimeoutMs = 2000;

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

  if (obj.bufferSizeM12 && typeof obj.bufferSizeM12 === 'number')
    bufferSize = obj.bufferSizeM12;

  if (obj.locatorResponseTimeout && typeof obj.locatorResponseTimeout === 'number')
    locatorResponseTimeoutMs = obj.locatorResponseTimeout * 1000;

  if (sendDurationM0 >= timeoutM0)
    throw 'property `sendDurationM0` has to be less than property `timeoutM0`';

  if (!obj.messages || !Array.isArray(obj.messages) || !obj.messages.length)
    throw 'property `messages` has to be a non-empty array';

  const items: {
    mac: string;
    type: 'm0' | 'm12' | 'unknown';
    value: number[];
    locatorMac?: string,
    locatorAddr?: string,
    error?: string;
  }[] = [];

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

  for (const m of obj.messages) {
    const mac = m.mac.replace(/:/g, '').toLowerCase();
    if (typeof m.value === 'string')
      m.value = Array.from(Buffer.from(m.value));
    if (!beacons[mac] || !beacons[mac].userData[0]) {
      items.push({ mac, type: 'unknown', value: m.value, error: 'beacon not found' });
    } else {
      let locatorMac = beacons[mac].nearestGateway;
      let locator = locators[locatorMac];
      if (!locator || !locator.ip) {
        locatorMac = beacons[mac].lastGateway;
        locator = locators[locatorMac];
      }
      if (!locator || !locator.ip) {
        items.push({ mac, type: 'unknown', value: m.value, error: `locator ${locatorMac} offline` });
      } else {
        const locatorAddr = locator.ip;
        if (items.find(x => x.locatorMac === locatorMac)) {
          items.push({ mac, type: beacons[mac].userData[0].method ? 'm12' : 'm0', value: m.value, locatorMac, locatorAddr, error: 'locator buzy' });
        } else {
          items.push({ mac, type: beacons[mac].userData[0].method ? 'm12' : 'm0', value: m.value, locatorMac, locatorAddr });
        }
      }
    }
  }

  const logs: string[] = [];

  const ps = items.map(async x => {
    if (x.error) return;
    switch (x.type) {
      case 'm0':
        try {
          await sendMessageM0BatchItem(logs, self, utils, x.mac, x.locatorMac, x.value, sendDurationM0, timeoutM0, locatorResponseTimeoutMs);
        } catch (e) {
          addLog(self, utils, logs, x.mac, 'ERROR', e);
          x.error = e;
        }
        break;
      case 'm12':
        try {
          await sendMessageM12BatchItem(logs, self, utils, x.mac, x.locatorMac, x.value, bufferSize, timeoutM12, beaconResponseDurationM12, locatorResponseTimeoutMs);
        } catch (e) {
          addLog(self, utils, logs, x.mac, 'ERROR', e);
          x.error = e;
        }
        break;
    }
  });

  await Promise.all(ps);

  self.status.status = 'idle';
  return {
    logs,
    results: items.map(x => ({
      mac: x.mac,
      ok: !x.error,
      error: x.error,
      locator: x.locatorMac,
    })),
  }
}

let _beaconRequestId = 10;
function getBeaconRequestId() {
  const id = _beaconRequestId;
  ++_beaconRequestId;
  if (_beaconRequestId > 0xff) _beaconRequestId = 0;
  return id;
}

function addLog(self: Plugin, utils: Utils, logs: string[], mac: string, tag: string, message: string) {
  const str = `[${utils.modules.moment().format('YY-MM-DD HH:mm:ss.SSS')} ${mac} ${tag}] ${message}`;
  logs.push(str);
  if (self.debug) {
    const log = self.logger[tag.toLowerCase()];
    log && log(`[sendMessageBatch ${mac}] ${message}`);
  }
}

async function sendMessageM12BatchItem(
  logs: string[],
  self: Plugin,
  utils: Utils,
  mac: string,
  locatorMac: string,
  value: number[],
  bufferSizeM12: number,
  timeoutM12: number,
  beaconResponseDurationM12: number,
  locatorResponseTimeoutMs: number,
) {
  addLog(self, utils, logs, mac, 'DEBUG', 'start by locator ' + locatorMac);
  const gl: IGroupedLocator = {
    mac: locatorMac,
    product: '',
    sMacs: [mac],
  };
  const numberOfPackets = Math.ceil(value.length / bufferSizeM12);
  const beaconRequestId = getBeaconRequestId();
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
    addLog(self, utils, logs, mac, 'DEBUG', 'sending m12 message ' + step);
    await sendMessageM12(utils, v, timeoutM12, locatorResponseTimeoutMs, gl);
    addLog(self, utils, logs, mac, 'DEBUG', 'waiting for response ' + step);
    await new Promise<void>(async (r, rr) => {
      let ok = false;
      const cb = (beacon_mac, buffer) => {
        if (mac === beacon_mac &&
          buffer[1] === beaconRequestId &&
          buffer[2] === idx &&
          !buffer[3]) {
          ok = true;
          r();
          utils.ee.off('beacon-response', cb);
        }
      };
      utils.ee.on('beacon-response', cb);
      setTimeout(() => {
        if (ok) return;
        rr('beacon response timeout.');
        utils.ee.off('beacon-response', cb);
      }, timeoutM12 * 1000);
    });
  }

  stopSendMessageM12(utils, locatorMac);
  addLog(self, utils, logs, mac, 'DEBUG', 'done');
}

async function sendMessageM0BatchItem(
  logs: string[],
  self: Plugin,
  utils: Utils,
  mac: string,
  locatorMac: string,
  value: string | number[],
  sendDurationM0: number,
  timeoutM0: number,
  locatorResponseTimeoutMs: number,
) {
  addLog(self, utils, logs, mac, 'DEBUG', 'start by locator ' + locatorMac);
  addLog(self, utils, logs, mac, 'DEBUG', 'sending m0 message');
  await sendMessageM0(utils, mac, locatorMac, value, sendDurationM0, locatorResponseTimeoutMs);

  addLog(self, utils, logs, mac, 'DEBUG', 'waiting for response');
  await new Promise<void>(async (r, rr) => {
    let ok = false;
    const cb = (beacon_mac, buffer) => {
      if (mac === beacon_mac) {
        ok = true;
        r();
        utils.ee.off('beacon-response', cb);
      }
    };
    utils.ee.on('beacon-response', cb);
    setTimeout(() => {
      if (ok) return;
      rr('beacon response timeout.');
      utils.ee.off('beacon-response', cb);
    }, timeoutM0 * 1000);
  });
  addLog(self, utils, logs, mac, 'DEBUG', 'done');
}