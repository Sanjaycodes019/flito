import React from 'react';
import AdminShell from './components/AdminShell';
import { ADMIN_SECTIONS } from './sections';
import DashboardScreen from './screens/DashboardScreen';

// Each section's screen wrapped in the shared shell. Built once at module
// level so a screen keeps its identity between renders (defining these inside
// a component would remount the page, and lose its scroll and filters, every
// time the navigator re-rendered).
const SECTION_SCREENS = ADMIN_SECTIONS.map((section) => {
  const Body = section.component;
  const Screen = () => (
    <AdminShell active={section.key}>
      <Body />
    </AdminShell>
  );
  Screen.displayName = `Admin_${section.key}`;
  return { ...section, Screen };
});

// What an admin sees on Home: the dashboard inside the console frame. The sidebar
// marks Home as the current page.
export const AdminHome = () => (
  <AdminShell active="home">
    <DashboardScreen />
  </AdminShell>
);

// An admin's Profile, in the same console frame (sidebar on a laptop).
export const AdminProfile = ({ ProfileScreen }) => (
  <AdminShell active="profile">
    <ProfileScreen />
  </AdminShell>
);

// The admin <Stack.Screen>s, for the signed-in stack to render (pass it that
// stack's own `Stack`). The title
// is the section's own name; the shell supplies the rest of the chrome.
export const renderAdminScreens = (Stack, t) => SECTION_SCREENS.flatMap((section) => [section.route, section.alsoAt?.route].filter(Boolean).map((route) => (
  <Stack.Screen key={route} name={route} component={section.Screen} options={{ title: t(section.labelKey) }} />
)));

// The web addresses of the admin sections, in react-navigation's linking shape.
export const adminLinkingScreens = Object.fromEntries(
  ADMIN_SECTIONS.flatMap((section) => [[section.route, section.path], ...(section.alsoAt ? [[section.alsoAt.route, section.alsoAt.path]] : [])]),
);
