export * from './config';
export * from './status';
export * from './i18n';

import { Context } from 'koa';
import { Plugin, Utils, parseHttpRequestBody } from './lib';
import { IBeaconEventBody, sendBeaconEvent } from './sendBeaconEvent';
import { IMessageBatchBody, sendMessageBatch } from './sendMessageBatch';

export async function init(self: Plugin, utils: Utils) {
  const config = await utils.loadConfig(self);
  const packUri = (p: string) => {
    return config.apiPrefix + p;
  };
  self.status.status = 'idle';
  setInterval(() => {
    utils.updateStatus(self);
  }, 1000);

  const errMsgBuzy = 'Busy now. Try later!';

  utils.http.apis.push(router => {
    const sendMessageBatchUri = packUri('/message/batch');
    router.post(sendMessageBatchUri, async ctx => {
      const requestBody = parseHttpRequestBody<IMessageBatchBody>(ctx);

      if (self.debug)
        self.logger.debug(`POST ${sendMessageBatchUri}`, JSON.stringify(requestBody, null, 2));
      if (self.status.status !== 'idle') {
        ctx.status = 400;
        ctx.body = errMsgBuzy;
        return;
      }

      try {
        const res = await sendMessageBatch(self, utils, requestBody);
        ctx.status = 200;
        ctx.body = res;
      } catch (e) {
        self.status.status = 'idle';
        self.logger.error(e);
        ctx.status = 400;
        ctx.body = { e };
      }
    });

    if (config.useDeprecatedApis) {
      router.post(packUri('/:mac/event'), async ctx => {
        if (self.status.status !== 'idle') {
          ctx.status = 400;
          ctx.body = errMsgBuzy;
          return;
        }

        try {
          const requestBody = parseHttpRequestBody<IBeaconEventBody>(ctx);
          requestBody.mac = ctx.params.mac;
          await sendBeaconEvent(self, utils, requestBody);
          ctx.status = 200;
          ctx.body = '';
        } catch (e) {
          self.status.status = 'idle';
          self.logger.error(e);
          ctx.status = 400;
          ctx.body = e;
        }
      });
    }
  })
  return true;
}

export async function test(self: Plugin, utils: Utils) {
  self.logger.info('Test', self.name);
  self.logger.info('Loading Config ..');
  const config = await utils.loadConfig(self);
  console.log(config);
  self.logger.info('Test OK.');
}
