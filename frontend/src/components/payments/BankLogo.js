import React from 'react';
import { View, Image } from 'react-native';
import Icon from '../../theme/icons';
import { colors, themedStyles } from '../../theme/tokens';

// Each bank's and wallet's own logo, as published on its official website
// (the source of every file is listed in assets/banks/SOURCES.md; Nabil's and
// Khalti's are their official SVGs drawn out as PNGs, so every logo shows the
// same way in the app and on the web). `aspect` is width over height, so a
// wide wordmark gets a wider tile than a square mark.
const LOGOS = {
  nabil: { source: require('../../../assets/banks/nabil.png'), aspect: 985 / 128 },
  nimb: { source: require('../../../assets/banks/nimb.png'), aspect: 525 / 455 },
  gibl: { source: require('../../../assets/banks/gibl.png'), aspect: 1 },
  nicasia: { source: require('../../../assets/banks/nicasia.png'), aspect: 1 },
  himalayan: { source: require('../../../assets/banks/himalayan.jpg'), aspect: 250 / 50 },
  everest: { source: require('../../../assets/banks/everest.png'), aspect: 1 },
  sbi: { source: require('../../../assets/banks/sbi.jpg'), aspect: 249 / 49 },
  scb: { source: require('../../../assets/banks/scb.png'), aspect: 1 },
  nbl: { source: require('../../../assets/banks/nbl.png'), aspect: 1 },
  rbb: { source: require('../../../assets/banks/rbb.png'), aspect: 1 },
  adbl: { source: require('../../../assets/banks/adbl.png'), aspect: 1 },
  kumari: { source: require('../../../assets/banks/kumari.png'), aspect: 1 },
  laxmisunrise: { source: require('../../../assets/banks/laxmisunrise.png'), aspect: 365 / 75 },
  siddhartha: { source: require('../../../assets/banks/siddhartha.png'), aspect: 257 / 67 },
  machhapuchchhre: { source: require('../../../assets/banks/machhapuchchhre.png'), aspect: 922 / 156 },
  citizens: { source: require('../../../assets/banks/citizens.png'), aspect: 170 / 115 },
  prime: { source: require('../../../assets/banks/prime.png'), aspect: 1 },
  nmb: { source: require('../../../assets/banks/nmb.png'), aspect: 1 },
  prabhu: { source: require('../../../assets/banks/prabhu.jpg'), aspect: 304 / 66 },
  sanima: { source: require('../../../assets/banks/sanima.png'), aspect: 352 / 44 },
  esewa: { source: require('../../../assets/banks/esewa.png'), aspect: 124 / 33 },
  khalti: { source: require('../../../assets/banks/khalti.png'), aspect: 2 },
};

// A wordmark's tile is wider than it is tall, up to this many times, so the
// name stays readable without pushing the text beside it off the row.
const MAX_TILE_ASPECT = 2.6;

// How wide a logo's tile is at a given height, for laying out beside it.
export const logoWidth = (kind, bankCode, size) => {
  const logo = LOGOS[kind === 'bank' ? bankCode : kind];
  return logo ? Math.round(size * Math.min(Math.max(logo.aspect, 1), MAX_TILE_ASPECT)) : size;
};

// A bank's or wallet's official logo on a white tile (the logos are drawn for
// white, so the tile stays white in dark mode too). A bank not on the list,
// one typed in as "other", shows a plain bank icon.
const BankLogo = ({ kind = 'bank', bankCode, size = 44 }) => {
  const logo = LOGOS[kind === 'bank' ? bankCode : kind];
  const width = logoWidth(kind, bankCode, size);
  const pad = Math.max(3, Math.round(size * 0.1));
  const tile = { width, height: size, borderRadius: Math.round(size * 0.22), padding: pad };

  if (!logo) {
    return (
      <View style={[styles.tile, styles.other, tile]}>
        <Icon name="bank" size={Math.round(size * 0.5)} color={colors.textSecondary} />
      </View>
    );
  }

  // The largest box of the logo's own shape that fits inside the padding.
  const innerW = width - pad * 2;
  const innerH = size - pad * 2;
  const fitW = Math.min(innerW, innerH * logo.aspect);
  const fitH = fitW / logo.aspect;

  return (
    <View style={[styles.tile, tile]} accessible={false}>
      <Image source={logo.source} style={{ width: fitW, height: fitH }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
};

const styles = themedStyles(() => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(30, 36, 43, 0.12)',
    overflow: 'hidden',
  },
  other: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
}));

export default BankLogo;
