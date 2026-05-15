import React, { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Section =
  | 'Dashboard'
  | 'Movies & Series'
  | 'Hero Slider'
  | 'Users'
  | 'Media Assets'
  | 'Announcements'
  | 'Feedback Hub'
  | 'Movie Layout'
  | 'Series Layout'
  | 'Subscription Plans'
  | 'Payments Log'
  | 'Content Health'
  | 'Profile Manager'
  | 'Audit Logs';

const navItems: { label: Section; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { label: 'Dashboard', icon: 'home-outline' },
  { label: 'Movies & Series', icon: 'filmstrip' },
  { label: 'Hero Slider', icon: 'star-outline' },
  { label: 'Users', icon: 'account-group-outline' },
  { label: 'Media Assets', icon: 'archive-outline' },
  { label: 'Announcements', icon: 'bullhorn-outline' },
  { label: 'Feedback Hub', icon: 'message-outline' },
  { label: 'Movie Layout', icon: 'view-grid-outline' },
  { label: 'Series Layout', icon: 'view-dashboard-outline' },
  { label: 'Subscription Plans', icon: 'medal-outline' },
  { label: 'Payments Log', icon: 'credit-card-outline' },
  { label: 'Content Health', icon: 'heart-pulse' },
  { label: 'Profile Manager', icon: 'account-outline' },
  { label: 'Audit Logs', icon: 'pulse' },
];

const stats = [
  { title: 'Total Users', value: '417', accent: '+12%\nthis\nweek', icon: 'account-group-outline', color: '#4f7cff' },
  { title: 'Total Revenue', value: '0\nUGX', accent: 'All\ntime', icon: 'currency-usd', color: '#49c98f' },
  { title: 'Active Subs', value: '29', accent: 'Growing', icon: 'play-circle-outline', color: '#49c98f' },
  { title: 'Today Revenue', value: '0\nUGX', accent: 'Today', icon: 'arrow-top-right', color: '#ff7a22' },
];

const rows = [
  { title: 'User Growth', meta: 'Last 7 Days', icon: 'trending-up', color: '#49d993' },
  { title: 'Revenue Trends', meta: 'Last 7 Days', icon: 'currency-usd', color: '#49d993' },
  { title: 'Most Watched', meta: 'Top 5', icon: 'play-circle-outline', color: '#5892ff' },
  { title: 'Recent Uploads', meta: 'Last 5', icon: 'filmstrip', color: '#49d993' },
  { title: 'New Signups', meta: 'Last 5', icon: 'account-group-outline', color: '#5892ff' },
];

export default function MovieZoneAdminPortal() {
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');

  const pageTitle = useMemo(() => {
    if (activeSection === 'Dashboard') return 'Dashboard Overview';
    return activeSection;
  }, [activeSection]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'THE MOVIE ZONE Admin Portal' }} />
      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>THE MOVIE ZONE</Text>
            <Text style={styles.brandSub}>ADMIN PORTAL</Text>
          </View>

          <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
            {navItems.map((item) => {
              const active = item.label === activeSection;
              return (
                <TouchableOpacity
                  key={item.label}
                  activeOpacity={0.8}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => setActiveSection(item.label)}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={23}
                    color={active ? '#071118' : '#a8acbb'}
                  />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                  {active ? <View style={styles.activeDot} /> : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity activeOpacity={0.8} style={styles.signOut}>
              <MaterialCommunityIcons name="logout" size={24} color="#ff6f71" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={22} color="#85889a" />
              <TextInput
                placeholder="Global Search (Cmd + K)..."
                placeholderTextColor="#76798b"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.statusWrap}>
              <View>
                <Text style={styles.statusTitle}>SYSTEM STATUS</Text>
                <Text style={styles.statusOnline}>- 3 Users Online</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <View style={styles.headingRow}>
              <Text style={styles.pageTitle}>{pageTitle}</Text>
              <Text style={styles.welcome}>Welcome back, Admin</Text>
            </View>

            {activeSection === 'Dashboard' ? (
              <>
                <View style={styles.statsGrid}>
                  {stats.map((item) => (
                    <View key={item.title} style={styles.statCard}>
                      <View style={styles.statText}>
                        <Text style={styles.statTitle}>{item.title}</Text>
                        <Text style={styles.statValue}>{item.value}</Text>
                      </View>
                      <Text style={styles.statAccent}>{item.accent}</Text>
                      <View style={[styles.statIcon, { backgroundColor: `${item.color}1f` }]}>
                        <MaterialCommunityIcons name={item.icon as any} size={40} color={item.color} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.panelList}>
                  {rows.map((row) => (
                    <TouchableOpacity key={row.title} activeOpacity={0.8} style={styles.panelRow}>
                      <View style={styles.panelTitleWrap}>
                        <MaterialCommunityIcons name={row.icon as any} size={24} color={row.color} />
                        <Text style={styles.panelTitle}>{row.title}</Text>
                        <Text style={styles.panelMeta}>{row.meta}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={24} color="#9aa0b2" />
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity activeOpacity={0.8} style={[styles.panelRow, styles.missionRow]}>
                    <View style={styles.missionIcon}>
                      <MaterialCommunityIcons name="chart-line" size={28} color="#5b85ff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.missionTitle}>LIVE MISSION CONTROL</Text>
                      <Text style={styles.missionSub}>REAL-TIME USER ENGAGEMENT</Text>
                    </View>
                    <View style={styles.livePill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={24} color="#9aa0b2" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.placeholder}>
                <MaterialCommunityIcons name="tools" size={42} color="#50d38d" />
                <Text style={styles.placeholderTitle}>{activeSection}</Text>
                <Text style={styles.placeholderBody}>
                  This local section is ready for edits. Tell me what you want changed here and I will build it into the localhost admin portal.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: '100%',
    flexDirection: 'row',
    backgroundColor: '#07080d',
  },
  sidebar: {
    width: 390,
    backgroundColor: '#19192b',
    borderRightWidth: 1,
    borderRightColor: '#2a2a3c',
  },
  brandBlock: {
    height: 164,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3c',
  },
  brand: {
    color: '#f8f8fb',
    fontSize: 29,
    fontWeight: '900',
  },
  brandSub: {
    color: '#4fc487',
    marginTop: 8,
    fontSize: 20,
    fontWeight: '900',
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    padding: 12,
    paddingTop: 33,
    paddingBottom: 30,
  },
  navItem: {
    height: 67,
    borderRadius: 13,
    paddingHorizontal: 23,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  navItemActive: {
    backgroundColor: '#49bd83',
    shadowColor: '#49bd83',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  navLabel: {
    color: '#d5d6df',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  navLabelActive: {
    color: '#071118',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2c8d63',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    height: 70,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3c',
    marginTop: 14,
    paddingLeft: 20,
  },
  signOutText: {
    color: '#ff6f71',
    fontSize: 24,
    fontWeight: '800',
  },
  main: {
    flex: 1,
  },
  topbar: {
    height: 117,
    backgroundColor: '#1d1d2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2b2b3c',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 67,
    gap: 40,
  },
  searchBox: {
    width: '60%',
    height: 64,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#333345',
    backgroundColor: '#252538',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 23,
    gap: 18,
  },
  searchInput: {
    flex: 1,
    color: '#f5f5f8',
    fontSize: 20,
    outlineStyle: 'none' as any,
  },
  statusWrap: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  statusTitle: {
    color: '#f6f7fb',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  statusOnline: {
    color: '#46d486',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4abedf',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4abedf',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  avatarText: {
    color: '#f7fbff',
    fontSize: 22,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    backgroundColor: '#090a10',
  },
  contentInner: {
    paddingHorizontal: 67,
    paddingTop: 68,
    paddingBottom: 42,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 41,
    fontWeight: '900',
  },
  welcome: {
    color: '#9a9daa',
    fontSize: 20,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 35,
  },
  statCard: {
    flex: 1,
    minHeight: 211,
    borderRadius: 20,
    backgroundColor: '#1b1b31',
    borderWidth: 1,
    borderColor: '#2c2c46',
    padding: 34,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  statText: {
    flex: 1,
  },
  statTitle: {
    color: '#9da1b2',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 18,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 43,
    lineHeight: 51,
    fontWeight: '900',
  },
  statAccent: {
    color: '#49d58c',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 26,
    marginRight: 10,
  },
  statIcon: {
    width: 89,
    height: 89,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelList: {
    gap: 34,
  },
  panelRow: {
    minHeight: 93,
    borderRadius: 19,
    backgroundColor: '#1b1b31',
    borderWidth: 1,
    borderColor: '#2b2b45',
    paddingHorizontal: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  panelTitle: {
    color: '#f5f5fa',
    fontSize: 24,
    fontWeight: '900',
  },
  panelMeta: {
    color: '#747788',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  missionRow: {
    minHeight: 110,
    gap: 16,
    paddingLeft: 19,
  },
  missionIcon: {
    width: 69,
    height: 69,
    borderRadius: 34,
    backgroundColor: '#24315b',
    borderWidth: 1,
    borderColor: '#334585',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionTitle: {
    color: '#f6f6fb',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  missionSub: {
    color: '#777b8d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
  },
  livePill: {
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e785a',
    backgroundColor: '#153d31',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ad990',
  },
  liveText: {
    color: '#4ad990',
    fontSize: 12,
    fontWeight: '900',
  },
  placeholder: {
    minHeight: 420,
    borderRadius: 20,
    backgroundColor: '#1b1b31',
    borderWidth: 1,
    borderColor: '#2b2b45',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 18,
  },
  placeholderBody: {
    color: '#9ea2b1',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 620,
    textAlign: 'center',
    marginTop: 12,
  },
});
