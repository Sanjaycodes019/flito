// FLITO's single icon source. Every icon in the app must come from this
// file, which pulls exclusively from MaterialCommunityIcons.
//
// Judgment call: the brief asked for "a single consistent icon library" and
// icons "relevant to project type" without naming one. Ionicons (the usual
// default for an Expo app) has no truck, delivery, warehouse or freight
// iconography at all. MaterialCommunityIcons ships in the same
// @expo/vector-icons package at zero extra cost and has literal icons for
// trucks, delivery, warehouses, packages, signatures and GPS pins, which
// this app uses constantly. It is the better fit for a truck-freight
// marketplace, so it is the one set used everywhere, never mixed with
// another family.
//
// Usage: <Icon name="load" size={iconSize.md} color={colors.primary} />
// `name` is a semantic key below, not a raw glyph name, so the underlying
// icon can change in one place without touching every screen.

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, iconSize } from './tokens';

// Semantic name -> MaterialCommunityIcons glyph. Keep this alphabetical by
// key and add new entries here, never inline a raw glyph name in a screen.
const GLYPHS = {
  // Navigation / tabs
  home: 'home-outline',
  homeActive: 'home',
  profile: 'account-outline',
  profileActive: 'account',
  fleet: 'truck-outline',
  fleetActive: 'truck',
  jobs: 'clipboard-list-outline',
  jobsActive: 'clipboard-list',
  earnings: 'cash-multiple',
  admin: 'shield-account-outline',
  back: 'chevron-left',
  forward: 'chevron-right',
  close: 'close',
  menu: 'menu',

  // Freight / logistics domain
  load: 'package-variant-closed',
  truck: 'truck-outline',
  truckDelivery: 'truck-delivery-outline',
  warehouse: 'warehouse',
  route: 'map-marker-path',
  pickup: 'map-marker-outline',
  dropoff: 'map-marker-check-outline',
  distance: 'ruler',
  weight: 'weight-kilogram',
  speedometer: 'speedometer',
  gps: 'crosshairs-gps',
  navigate: 'navigation-variant-outline',

  // Goods and truck kinds (picture buttons)
  goodsCement: 'wall',
  goodsFood: 'grain',
  goodsFurniture: 'sofa-outline',
  goodsProduce: 'carrot',
  goodsStone: 'terrain',
  goodsFuel: 'gas-station-outline',
  goodsMachine: 'engine-outline',
  goodsOther: 'dots-horizontal-circle-outline',
  truckPickup: 'van-utility',
  truckSmall: 'truck-outline',
  truckMedium: 'truck-delivery-outline',
  truckLarge: 'truck',
  truckContainer: 'truck-cargo-container',
  truckTrailer: 'truck-trailer',
  bodyFlatbed: 'truck-flatbed',
  bodyTipper: 'dump-truck',
  bodyTanker: 'tanker-truck',
  bodyCold: 'snowflake',
  fuel: 'gas-station-outline',
  electric: 'flash-outline',
  area: 'map-outline',

  // Money
  price: 'currency-inr', // Rs. amounts, closest available currency glyph
  wallet: 'wallet-outline',
  quote: 'file-document-edit-outline',
  counterOffer: 'swap-horizontal',

  // People / roles
  person: 'account-outline',
  driver: 'account-hard-hat',
  shipper: 'account-tie-outline',
  owner: 'domain',
  people: 'account-group-outline',

  // Documents / KYC
  document: 'file-document-outline',
  idCard: 'card-account-details-outline',
  upload: 'tray-arrow-up',
  camera: 'camera-outline',
  cameraFlip: 'camera-flip-outline',
  cameraOff: 'camera-off-outline',
  image: 'image-outline',
  signature: 'signature-freehand',
  verified: 'shield-check-outline',
  unverified: 'shield-alert-outline',
  pending: 'shield-sync-outline',

  // Status / feedback
  success: 'check-circle-outline',
  warning: 'alert-circle-outline',
  error: 'close-circle-outline',
  info: 'information-outline',
  star: 'star',
  starOutline: 'star-outline',

  // Actions
  add: 'plus',
  edit: 'pencil-outline',
  trash: 'trash-can-outline',
  search: 'magnify',
  filter: 'filter-variant',
  refresh: 'refresh',
  send: 'send-outline',
  share: 'share-variant-outline',
  logout: 'logout',
  settings: 'cog-outline',
  language: 'translate',
  appearance: 'theme-light-dark',
  radioOff: 'radiobox-blank',
  radioOn: 'radiobox-marked',
  bell: 'bell-outline',
  bellActive: 'bell',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  checkmark: 'check',
  checkboxOff: 'checkbox-blank-outline',
  checkboxOn: 'checkbox-marked',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  phone: 'phone-outline',
  email: 'email-outline',
  lock: 'lock-outline',
  time: 'clock-outline',
  calendar: 'calendar-blank-outline',
  history: 'history',
  empty: 'inbox-outline',
  offline: 'wifi-off',
  location: 'map-marker-radius-outline',
};

// Icons sit next to a text label almost everywhere in this app (a button's
// title, a detail row's caption, a status badge's word). A screen reader
// would otherwise announce the underlying icon-font glyph as a stray
// character on top of that label, so every icon is hidden from the
// accessibility tree by default. The rare icon-only control (SignaturePad's
// close button) puts its own accessibilityLabel on the enclosing Pressable,
// which is what actually needs to be announced.
const Icon = ({ name, size = iconSize.md, color = colors.textPrimary, style, ...rest }) => {
  const glyph = GLYPHS[name];
  if (!glyph && __DEV__) {
    console.warn(`Icon: unknown semantic name "${name}". Add it to theme/icons.js.`);
  }
  return (
    <MaterialCommunityIcons
      name={glyph || 'help-circle-outline'}
      size={size}
      color={color}
      style={style}
      accessible={false}
      importantForAccessibility="no"
      focusable={false}
      aria-hidden
      {...rest}
    />
  );
};

export default Icon;
export { GLYPHS as ICON_GLYPHS };
