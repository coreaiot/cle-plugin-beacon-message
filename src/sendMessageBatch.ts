import { checkSum1B } from "./checkSum1B";
import { IBeacons, IBinaryCommand, IGatewayResultIndexedByMac, Plugin, Utils, addColonToMac } from "./lib";
import { getBeacons } from "./lib/getBeacons";
import { IGroupedLocator, sendMessageM12 } from "./sendMessageM12";

export interface IMessageBatchBody {
  timeout?: number; // 全局超时时间（秒）（留空时 M0 信标为 10 秒，M1，M2 信标为 3 秒）
  timeoutM0?: number; // M0 信标超时时间（秒）（留空时使用全局超时时间）
  timeoutM12?: number; // M1，M2 信标超时时间（秒）（留空时使用全局超时时间）
  sendDurationM0?: number; // M0 信标发送时间（秒）（留空时为 5 秒）
  bufferSizeM12?: number; // M1，M2 分包长度（字节）（不大于 200）（留空时为 200）
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
  self.status.status = 'buzy';
  utils.updateStatus(self);
  // L.log('/beacons/message/batch', ctx.request.body);
  // const m0: string[] = [];
  // const m12: string[] = [];
  let sendDurationM0 = 5;
  let timeoutM0 = 10;
  let timeoutM12 = 3;
  // let value: number[] = [];
  let bufferSize = 200;

  if (obj.timeout && typeof obj.timeout === 'number') {
    timeoutM0 = obj.timeout;
    timeoutM12 = obj.timeout;
  }

  if (obj.timeoutM0 && typeof obj.timeoutM0 === 'number')
    timeoutM0 = obj.timeoutM0;

  if (obj.timeoutM12 && typeof obj.timeoutM12 === 'number')
    timeoutM12 = obj.timeoutM12;

  if (obj.sendDurationM0 && typeof obj.sendDurationM0 === 'number')
    sendDurationM0 = obj.sendDurationM0;

  if (obj.bufferSizeM12 && typeof obj.bufferSizeM12 === 'number')
    bufferSize = obj.bufferSizeM12;

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
    const now = new Date().getTime();
    const ts = now - utils.projectEnv.locatorLifeTime;
    const data = utils.packGatewaysByMac(utils.activeLocators, ts);
    return data;
  })();

  for (const m of obj.messages) {
    const mac = m.mac.replace(/:/g, '').toLowerCase();
    if (typeof m.value === 'string')
      m.value = Array.from(Buffer.from(m.value));
    if (!beacons[mac] || !beacons[mac].userData[0]) {
      items.push({ mac, type: 'unknown', value: m.value, error: 'beacon not found' });
    } else {
      const locatorMac = beacons[mac].nearestGateway;
      const locator = locators[addColonToMac(locatorMac)];
      if (!locator) {
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
      // case 'm0':
      //   try {
      //     await sendMessageM0(logs, udp, beacons, x.mac, x.locator, x.value, sendDurationM0, timeoutM0);
      //   } catch (e) {
      //     addLog(logs, x.mac, 'ERROR', e);
      //     x.error = e;
      //   }
      //   break;
      case 'm12':
        try {
          await sendMessageM12BatchItem(logs, utils, x.mac, x.locatorMac, x.locatorAddr, x.value, bufferSize, timeoutM12, 1000);
        } catch (e) {
          addLog(utils, logs, x.mac, 'ERROR', e);
          x.error = e;
        }
        break;
    }
  });

  await Promise.all(ps);

  self.status.status = 'idle';
  utils.updateStatus(self);
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

function addLog(utils: Utils, logs: string[], mac: string, tag: string, message: string) {
  const str = `[${utils.modules.moment().format('YY-MM-DD HH:mm:ss')} ${mac} ${tag}] ${message}`;
  logs.push(str);
  console.log(str);
}

async function sendMessageM12BatchItem(
  logs: string[],
  utils: Utils,
  mac: string,
  locatorMac: string,
  locatorAddr: string,
  value: number[],
  bufferSizeM12: number,
  timeoutM12: number,
  locatorResponseTimeoutMs: number,
) {
  addLog(utils, logs, mac, 'DEBUG', 'start by locator ' + locatorMac);
  const gl: IGroupedLocator = {
    mac: locatorMac,
    ip: locatorAddr,
    product: '',
    sMacs: [mac],
  };
  const numberOfPackets = Math.ceil(value.length / bufferSizeM12);
  const beaconRequestId = getBeaconRequestId();
  for (let idx = 0; idx < numberOfPackets; ++idx) {
    const data = value.slice(idx * bufferSizeM12, (idx + 1) * bufferSizeM12);

    const timeoutMS = timeoutM12 * 1000;
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


    addLog(utils, logs, mac, 'DEBUG', 'sending m12 message ' + (idx + 1) + '/' + numberOfPackets);
    await sendMessageM12(utils, v, timeoutM12, locatorResponseTimeoutMs, 'start', gl);
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
        rr('Beacon response timeout.');
        utils.ee.off('beacon-response', cb);
      }, timeoutMS);
    });
  }

  addLog(utils, logs, mac, 'DEBUG', 'done');
}