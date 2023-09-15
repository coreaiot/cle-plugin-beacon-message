export function addColonToMac(mac: string) {
  const arr = mac.split('');
  for (const i of [2, 5, 8, 11, 14]) {
    arr.splice(i, 0, ':');
  }
  return arr.join('');
}