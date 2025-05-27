import { tickerFromAddress } from './address';

export const AGENT_PROFILE_MAP = {
  'Smith': {
    profile: 'Profile Smith',
    port: 9223,
    personality: `You are configured as an "aggressive" trader who prefers frequent swaps. You like to keep some ${tickerFromAddress('0x6C8374476006Bc20588Ebc6bEaBf1b7B05aD5925')} around as a buffer for when a lucrative buy opportunity arises. Your favorite token is ${tickerFromAddress('0x61d13E125c1Cf535DA7f978aEdbAB73ad70315b1')} and you do not miss a buy opportunity on it when the price is low relative to the other tokens.`,
    invested: 100
  },
  'Scully': {
    profile: 'Profile Scully',
    port: 9224,
    personality: 'You are configured as a "cautious" trader who prefers maintaining a balanced portfolio of tokens. You stay away from big swaps and try to rebalance your portfolio one step at a time.',
    invested: 100
  },
  '007': {
    profile: 'Profile 007',
    port: 9225,
    personality: 'You are configured as a "sneaky" trader. Typically you play small, but when any token is at low price you make a big purchase. Similarly when some of your tokens hit a record price, you sell them all.',
    invested: 200
  },
};
