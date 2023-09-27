<!-- lang zh-CN begin -->
# *发送信标消息 (旧版本)(弃用)*

这个接口只能下发 M0 消息。

> POST `API_ADDRESS`/`PREFIX`/msg

短消息，最多 21 个字节

> POST `API_ADDRESS`/`PREFIX`/msgLong

长消息，最多 63 个字节

## 参数

| 名称 | In | 可选 | 简介 |
|---|---|---|---|
| json | body | NO | JSON Body |

## HTTP 状态码

| 状态码 | 简介 | Body |
|---|---|---|
| 200 | 成功 | JSON Result |
| 400 | 失败 | Error Message |

## JSON Body 结构
```ts
export interface IMsgBody {
  mac?: string; // 信标 MAC（留空为广播至所有信标）
  duration?: [number, number] // 基站下发时长和等待周期
  value: number[]; // 消息内容
}
```

## JSON Result 结构
```ts
export interface IMsgResult {
  beacons: string[]; // 发关成功的信标 MAC
}
```

## 示例
<!-- lang zh-CN end -->

<!-- lang en-US begin -->
# *Send message to beacons (old version)(deprecated)*

This API only works with M0 beacons.

> POST `API_ADDRESS`/`PREFIX`/msg

Short message no more than 21 bytes

> POST `API_ADDRESS`/`PREFIX`/msgLong

Long message no more than 63 bytes

## Params

| Name | In | Optional | Description |
|---|---|---|---|
| json | body | NO | JSON Body |

## HTTP status code

| Code | Description | Body |
|---|---|---|
| 200 | OK | JSON Result |
| 400 | Failed | Error Message |

## JSON Body structure
```ts
export interface IMessageBody {
  macs?: string[]; // Beacon MACs - If not set, it sends message to all M0 beacons.
  timeout?: number; // Global timeout (second) - If not set, 10s for M0 beacons, and 3s for M1. M2 beacons.
  timeoutM0?: number; // Timeout for M0 beacons (second) - If not set, it uses the global timeout.
  timeoutM12?: number; // Timeout for M1，M2 beacons (second) - If not set, it uses the global timeout.
  sendDurationM0?: number; // Duration for locators sending M0 beacons (second) - 5s if not set
  locator?: string; // The locator to send message (IP or MAC) - If not set, it uses the nearest locator.
  bufferSize?: number;// Packeage buffer size for M1, M2 beacons (bytes) - It must not be greater than 200. If not set, it uses 200.
  value: number[]; // Message content
}
export interface IMsgBody {
  mac?: string; // Beacon MAC - If not set, it sends message to all beacons.
  duration?: [number, number] // Durations for locator sending message and CLE waiting for response.
  value: number[]; // Message content
}
```

## JSON Result structure
```ts
export interface IMsgResult {
  beacons: string[]; // Beacons successfully received the message.
}
```

## Example
<!-- lang en-US end -->

> POST http://localhost:44444/beacons/msg
```json
{
	"value":[1, 2, 3]
}
```

> 200
```json
{
  "beacons": ["3cfad3b09998", "3cfad3b09999"]
}
```
