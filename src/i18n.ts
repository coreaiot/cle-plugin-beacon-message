import { generateI18n } from "./lib";

export const i18n = generateI18n({
  'zh-CN': {
    'MQTT Plugin configurations.': 'MQTT 插件配置',
    'Port': '端口',
    'Topic': '主题',
    'Username': '用户名',
    'Password': '密码',
    'Client ID. Leave it empty to use a ramdom ID.': 'Client ID。留空则使用随机 ID。',
    'JSON (Compressed by Deflate)': 'JSON (使用 Deflate 压缩数据)',
    'Binary': '二进制',
    'Post beacons': '发送信标',
    'Post locators': '发送基站',
    'Post beacons count': '发送信标收包统计',
    'Post outdated beacons': '发送过期信标数据',
    'MQTT Protocol Version': 'MQTT 协议版本',
    'Connection': '连接',
    'Data Format': '数据格式',
  },
});