<!-- lang zh-CN begin -->
# 批量发送信标消息

> POST `API_ADDRESS`/`PREFIX`/message/batch

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
export interface IMessageBatchBody {
  timeout?: number; // 全局超时时间（秒）（留空时 M0 信标为 10 秒，M1，M2 信标为 3 秒）
  timeoutM0?: number; // M0 信标超时时间（秒）（留空时使用全局超时时间）
  timeoutM12?: number; // M1，M2 信标超时时间（秒）（留空时使用全局超时时间）
  sendDurationM0?: number; // M0 信标发送时间（秒）（留空时为 5 秒）
  beaconResponseDurationM12?: number; // M1, M2 信标回复时间（秒）（留空时为 3 秒）
  bufferSizeM12?: number; // M1，M2 分包长度（字节）（不大于 200）（留空时为 200）
  locatorResponseTimeout?: number; // 基站回复超时时间（秒）（留空时为 2 秒）
  messages: {
    mac: string; // 信标 MAC
    value: string | number[]; // 消息内容
  }[];
}
```

## JSON Result 结构
```ts
export interface IMessageBatchResult {
  logs: string[]; // 日志
  results: {
    mac: string; // 信标 MAC
    ok: boolean; // 是否成功
    error: string; // 失败原因
    locator: string; // 发送基站
  }[];
}
```

## 示例
<!-- lang zh-CN end -->

<!-- lang en-US begin -->
# Send message to beacons (batch)

> POST `API_ADDRESS`/`PREFIX`/message/batch

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
export interface IMessageBatchBody {
  timeout?: number; // Global timeout (second) - If not set, 10s for M0 beacons, and 3s for M1.
  timeoutM0?: number; // Timeout for M0 beacons (second) - If not set, it uses the global timeout.
  timeoutM12?: number; // Timeout for M1，M2 beacons (second) - If not set, it uses the global timeout.
  sendDurationM0?: number; // Duration for locators sending M0 beacons (second) - 5s if not set
  beaconResponseDurationM12?: number; // Duration for beacon response for M1, M2 beacons (second) - 3s if not set
  bufferSizeM12?: number; // Packeage buffer size for M1, M2 beacons (bytes) - It must not be greater than 200. If not set, it uses 200.
  locatorResponseTimeout?: number; // Timeout for CLE receiving message from locators (second) - 2s if not set
  messages: {
    mac: string; // Beacon MAC
    value: string | number[]; // Message content
  }[];
}
```

## JSON Result structure
```ts
export interface IMessageBatchResult {
  logs: string[]; // Logs
  results: {
    mac: string; // Beacon MAC
    ok: boolean; // Success
    error: string; // Error message
    locator: string; // The locator to send message
  }[];
}
```

## Example
<!-- lang en-US end -->

> POST http://localhost:44444/beacons/message/batch
```json
{
	"messages": [
		{
			"mac": "a1a1113001b8",
			"value": [9, 6, 10, 0]
		},
		{
			"mac": "32b00ae08db2",
			"value": [165,0,186,161,...]
		}
	]
}
```

> 200
```json
{
	"logs": [
		"[23-07-07 15:57:48 a1a1113001b8 DEBUG] start by locator 3cfad3b03333",
		"[23-07-07 15:57:48 a1a1113001b8 DEBUG] sending m12 message 1/1",
		"[23-07-07 15:57:48 32b00ae08db2 DEBUG] start by locator 3cfad3b09fee",
		"[23-07-07 15:57:48 32b00ae08db2 DEBUG] sending m12 message 1/1",
		"[23-07-07 15:57:49 32b00ae08db2 DEBUG] done",
		"[23-07-07 15:57:50 a1a1113001b8 DEBUG] done"
	],
	"results": [
		{
			"mac": "a1a1113001b8",
			"ok": true
		},
		{
			"mac": "32b00ae08db2",
			"ok": true
		}
	]
}
```
