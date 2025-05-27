const addressMap = {
  '0x0e8718B882C0E79FAa9a0C923597Cb25E60E2BaB': 'SF-STS',
  '0x6C8374476006Bc20588Ebc6bEaBf1b7B05aD5925': 'EURG',
  '0xF01322317E845D2B1e95e49aA792b91E578F0758': 'SF-MAP',
  '0x61d13E125c1Cf535DA7f978aEdbAB73ad70315b1': 'SF-MZS',
  '0xB4f2967cED1C09bB77C391E56B849afd5302baF5': 'SF-JME',
  '0xca5591F68e56bEa81d7575Fb5825722E200d8d16': 'SF-VIP',
  '0x6D3E58d0FEeBAC563002B1020bA2f003a058D526': 'SF-IVP',
  '0x6BC98847a29F4688c63aE890012ab07Bb2bC63B8': 'SF-MAV',
  '0x712C2d3dde8DE454a7aA014D21073Cb4777c519F': 'SF-WTS',
  '0x1FcBC348890AFDF7aFDB02c6D0EE54967730f80E': 'SF-NCO',
  '0x0a395e4E85AbCE554047256AC23713ca798Db629': 'SF-SON',
  '0x95a3188572Bb9ECf5866ef0e4287C0E49c7b7f8e': 'SF-LRG',
};

// reverse of addressMap
const tickerMap = Object.fromEntries(
  Object.entries(addressMap).map(([address, ticker]) => [ticker, address])
);

export function tickerFromAddress(address: string) {
  if (address in addressMap) {
    return addressMap[address];
  }

  return address;
};

export function addressFromTicker(ticker: string) {
  if (ticker in tickerMap) {
    return tickerMap[ticker];
  }

  return ticker;
}
