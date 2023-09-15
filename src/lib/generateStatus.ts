export function generateStatus<const Fields extends ReadonlyArray<{
  name: string;
  description: string;
}>>(opt: {
  fields: Fields,
  getResult(
    obj: {
      [k in Fields[number]['name'] | 'result']: string;
    },
  ): string;
  getStyle(
    obj: {
      [k in Fields[number]['name'] | 'result']: string;
    },
    key: Fields[number]['name'] | 'result',
  ): string;
}) {
  return opt;
}
