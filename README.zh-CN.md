# 发送信标事件

POST http://localhost:44444/beacons/:mac/event

> 参数

| Name | In | Optional | Description |
|---|---|---|---|
| mac | path | NO | Beacon mac |
| json | body | NO | JSON Body |

> HTTP 状态码

| Code | Description | Body |
|---|---|---|
| 200 | OK | Empty |
| 400 | Failed | Empty|
| 404 | Not Found | Error Message|

> JSON 结构
```ts
{
  value: number; // 事件值
  duration?: number; // 事件时长 (s)
  ext?: number[3]; // 扩展
}
```

> Example. POST http://localhost:44444/beacons/ada29b164768/event
```json
{
	"value":1,
	"duration":20
}
```