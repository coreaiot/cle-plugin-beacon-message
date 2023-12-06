import { generateConfig } from '@lib';

export const config = generateConfig({
  description: 'Beacon Message Plugin configurations.',
  fields: [
    {
      name: 'apiPrefix',
      type: 'dropdown',
      items: [
        {
          label: '/beacons',
          value: '/beacons',
        },
        {
          label: '/plugins/cle-plugin-beacon-message',
          value: '/plugins/cle-plugin-beacon-message',
        },
      ],
      description: 'API Prefix',
      value: '/beacons',
    },
    {
      name: 'useDeprecatedApis',
      type: 'switch',
      description: 'Use deprecated APIs',
      value: true,
    },
  ],
});