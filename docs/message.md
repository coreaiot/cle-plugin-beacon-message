<!-- lang zh-CN begin -->
# 发送信标消息

> POST `API_ADDRESS`/`PREFIX`/message

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
export interface IMessageBody {
  macs?: string[]; // 信标 MAC（留空为广播至所有 M0 信标）
  timeout?: number; // 全局超时时间（秒）（留空时 M0 信标为 10 秒，M1，M2 信标为 3 秒）
  timeoutM0?: number; // M0 信标超时时间（秒）（留空时使用全局超时时间）
  timeoutM12?: number; // M1，M2 信标超时时间（秒）（留空时使用全局超时时间）
  sendDurationM0?: number; // M0 信标发送时间（秒）（留空时为 5 秒）
  locator?: string; // 指定基站发送。（IP 或 MAC）（留空时使用最近信号最好的基站）
  bufferSize?: number;// M1, M2 分包长度（字节）（不大于 200）（留空时为 200）
  value: number[]; // 消息内容
}
```

## JSON Result 结构
```ts
export interface IMessageResult {
  beacons: string[]; // 发关成功的信标 MAC
}
```

## 示例
<!-- lang zh-CN end -->

<!-- lang en-US begin -->
# Send message to beacons

> POST `API_ADDRESS`/`PREFIX`/message

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
```

## JSON Result structure
```ts
export interface IMessageResult {
  beacons: string[]; // Beacons successfully received the message.
}
```

## Example
<!-- lang en-US end -->

> POST http://localhost:44444/beacons/message
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
