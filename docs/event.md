<!-- lang zh-CN begin -->
# *发送信标事件 (弃用)*

> POST `API_ADDRESS`/`PREFIX`/:mac/event

## 参数

| 名称 | In | 可选 | 简介 |
|---|---|---|---|
| mac | path | NO | 信标 MAC |
| json | body | NO | JSON Body |

## HTTP 状态码

| 状态码 | 简介 | Body |
|---|---|---|
| 200 | 成功 | 空 |
| 400 | 失败 | Error Message |

## JSON Body 结构
```ts
export interface IEventBody {
  value: number; // 事件值
  duration?: number; // 事件发送时长 (s)。默认 5 秒
  timeout?: number; // 接口调用超时时间 (ms)。默认为 `duration * 1000` 毫秒
  ext?: [number, number, number]; // 扩展。默认 [0, 0, 0]
}
```

## 示例
<!-- lang zh-CN end -->

<!-- lang en-US begin -->
# *Send event to beacons (deprecated)*

> POST `API_ADDRESS`/`PREFIX`/:mac/event

## Params

| Name | In | Optional | Description |
|---|---|---|---|
| mac | path | NO | Beacon MAC |
| json | body | NO | JSON Body |

## HTTP status code

| Code | Description | Body |
|---|---|---|
| 200 | OK | Empty |
| 400 | Failed | Error Message |

## JSON Body structure
```ts
export interface IEventBody {
  value: number; // Event value
  duration?: number; // Duration for locators sending event (s) - If not set, it uses 5s.
  timeout?: number; // Timeout for the API call (ms) - If not set, it uses `duration * 1000` ms.
  ext?: [number, number, number]; // Event extensions - If not set, it uses  [0, 0, 0].
}
```

## Example
<!-- lang en-US end -->

> POST POST http://localhost:44444/beacons/ada29b164768/event
```json
{
	"value":1,
	"duration":20
}
```

> 200
```json
```