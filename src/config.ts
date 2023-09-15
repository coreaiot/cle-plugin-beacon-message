import { generateConfig } from './lib';

export const config = generateConfig({
  description: 'Beacon Message Plugin configurations.',
  fields: [
    {
      name: 'doNotUseApiPrefix',
      type: 'switch',
      description: 'Do NOT use API prefix',
      value: true,
    },
  ],
});