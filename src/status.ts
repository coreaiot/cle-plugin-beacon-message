import { generateStatus } from "./lib";

export const status = generateStatus({
  fields: [
    {
      name: 'status',
      description: 'Status',
    },
  ],
  getResult(obj) {
    if (obj.status === 'buzy')
      return 'buzy';
    return 'idle'
  },
  getStyle(obj, key) {
    switch (key) {
      case 'result':
      case 'status':
        if (obj.status === 'buzy') return 'secondary';
        return 'success';
      default:
        return '';
    }
  },
});
