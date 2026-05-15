import React, { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../constants/firebaseConfig';
import { Plan, PLANS } from '../constants/planData';

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

const PlanInput = ({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) => (
  <View style={styles.planInputWrap}>
    <Text style={styles.planInputLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor="#686c7d"
      style={styles.planInput}
    />
  </View>
);

const inferPlanDailyLimit = (plan: Plan) => {
  const name = plan.name.toLowerCase();
  if (plan.externalDownloadDailyLimit) return plan.externalDownloadDailyLimit;
  if (name.includes('2 month')) return 5;
  if (name.includes('1 month') || name.includes('month')) return 3;
  if (name.includes('2 week')) return 2;
  return plan.downloadLimit || 1;
};

const inferPlanTotalLimit = (plan: Plan) => {
  const name = plan.name.toLowerCase();
  if (plan.externalDownloadTotalLimit) return plan.externalDownloadTotalLimit;
  if (name.includes('1 day')) return 1;
  if (name.includes('1 week')) return 8;
  if (name.includes('2 week')) return 16;
  if (name.includes('1 month') || name === 'month') return 32;
  if (name.includes('2 month')) return 60;
  return plan.downloadLimit || 1;
};

export default function MovieZoneAdminPortal() {
  const { width: viewportWidth } = useWindowDimensions();
  const isCompact = viewportWidth < 768;
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [plansLoading, setPlansLoading] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const pageTitle = useMemo(() => {
    if (activeSection === 'Dashboard') return 'Dashboard Overview';
    return activeSection;
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'Subscription Plans') return;

    const loadPlans = async () => {
      setPlansLoading(true);
      try {
        const snap = await getDocs(collection(db, 'plans'));
        const livePlans = snap.docs
          .map(planDoc => ({ id: planDoc.id, ...planDoc.data() } as Plan))
          .sort((a, b) => (((a as any).order || 0) - ((b as any).order || 0)));
        setPlans(livePlans.length > 0 ? livePlans : PLANS);
      } catch (error) {
        setPlans(PLANS);
      } finally {
        setPlansLoading(false);
      }
    };

    loadPlans();
  }, [activeSection]);

  const updatePlanField = (id: string, key: keyof Plan, value: any) => {
    setPlans(prev => prev.map(plan => plan.id === id ? { ...plan, [key]: value } : plan));
  };

  const savePlan = async (plan: Plan) => {
    setSavingPlanId(plan.id);
    try {
      const dailyLimit = inferPlanDailyLimit(plan);
      const totalLimit = inferPlanTotalLimit(plan);
      await setDoc(doc(db, 'plans', plan.id), {
        ...plan,
        deviceLimit: Number(plan.deviceLimit) || 1,
        durationDays: Number(plan.durationDays) || 1,
        downloadLimit: Number(dailyLimit) || 1,
        externalDownloadDailyLimit: Number(dailyLimit) || 1,
        externalDownloadTotalLimit: Number(totalLimit) || 1,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Saved', `${plan.name} now applies in the app.`);
    } catch (error) {
      Alert.alert('Error', 'Could not save this plan.');
    } finally {
      setSavingPlanId(null);
    }
  };

  const renderPlans = () => (
    <View style={styles.planGrid}>
      {plansLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#49d58c" size="large" />
        </View>
      ) : plans.map(plan => {
        const dailyLimit = inferPlanDailyLimit(plan);
        const totalLimit = inferPlanTotalLimit(plan);
        const isSaving = savingPlanId === plan.id;

        return (
          <View key={plan.id} style={[styles.planCard, isCompact && styles.planCardCompact]}>
            <View style={[styles.planHeader, isCompact && styles.planHeaderCompact]}>
              <View>
                <Text style={[styles.planName, { color: plan.color || '#49d58c' }]}>{plan.name}</Text>
                <Text style={styles.planMeta}>{plan.durationDays} days · {plan.price} {plan.currency}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.savePlanBtn, isSaving && { opacity: 0.5 }]}
                onPress={() => savePlan(plan)}
                disabled={isSaving}
              >
                <Text style={styles.savePlanText}>{isSaving ? 'Saving' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.limitGrid}>
              <PlanInput label="Price" value={plan.price} onChangeText={(text) => updatePlanField(plan.id, 'price', text)} />
              <PlanInput label="Duration days" value={String(plan.durationDays || '')} onChangeText={(text) => updatePlanField(plan.id, 'durationDays', parseInt(text, 10) || 0)} />
              <PlanInput label="Devices" value={String(plan.deviceLimit || '')} onChangeText={(text) => updatePlanField(plan.id, 'deviceLimit', parseInt(text, 10) || 0)} />
              <PlanInput label="Daily external" value={String(dailyLimit)} onChangeText={(text) => {
                const next = parseInt(text, 10) || 0;
                updatePlanField(plan.id, 'externalDownloadDailyLimit', next);
                updatePlanField(plan.id, 'downloadLimit', next);
              }} />
              <PlanInput label="Total external" value={String(totalLimit)} onChangeText={(text) => updatePlanField(plan.id, 'externalDownloadTotalLimit', parseInt(text, 10) || 0)} />
            </View>

            <Text style={styles.planRule}>
              {totalLimit} total external downloads · {dailyLimit}/day · {plan.deviceLimit || 1} device
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'THE MOVIE ZONE Admin Portal' }} />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        {!isCompact ? <View style={styles.sidebar}>
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
        </View> : null}

        <View style={styles.main}>
          <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
            {isCompact ? (
              <TouchableOpacity activeOpacity={0.8} style={styles.menuButton}>
                <MaterialCommunityIcons name="menu" size={28} color="#b7bbca" />
              </TouchableOpacity>
            ) : null}
            <View style={[styles.searchBox, isCompact && styles.searchBoxCompact]}>
              <Ionicons name="search" size={22} color="#85889a" />
              <TextInput
                placeholder={isCompact ? 'Search...' : 'Global Search (Cmd + K)...'}
                placeholderTextColor="#76798b"
                style={[styles.searchInput, isCompact && styles.searchInputCompact]}
              />
            </View>
            <View style={[styles.statusWrap, isCompact && styles.statusWrapCompact]}>
              <View style={isCompact && styles.hideOnCompact}>
                <Text style={styles.statusTitle}>SYSTEM STATUS</Text>
                <Text style={styles.statusOnline}>- 3 Users Online</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </View>
            </View>
          </View>

          {isCompact ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mobileNav}
              contentContainerStyle={styles.mobileNavContent}
            >
              {navItems.map(item => {
                const active = item.label === activeSection;
                return (
                  <TouchableOpacity
                    key={item.label}
                    activeOpacity={0.8}
                    style={[styles.mobileNavItem, active && styles.mobileNavItemActive]}
                    onPress={() => setActiveSection(item.label)}
                  >
                    <MaterialCommunityIcons name={item.icon} size={18} color={active ? '#071118' : '#a8acbb'} />
                    <Text style={[styles.mobileNavLabel, active && styles.mobileNavLabelActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, isCompact && styles.contentInnerCompact]}>
            <View style={[styles.headingRow, isCompact && styles.headingRowCompact]}>
              <Text style={[styles.pageTitle, isCompact && styles.pageTitleCompact]} numberOfLines={2}>{pageTitle}</Text>
              <Text style={[styles.welcome, isCompact && styles.welcomeCompact]}>Welcome back, Admin</Text>
            </View>

            {activeSection === 'Dashboard' ? (
              <>
                <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                  {stats.map((item) => (
                    <View key={item.title} style={[styles.statCard, isCompact && styles.statCardCompact]}>
                      <View style={styles.statText}>
                        <Text style={[styles.statTitle, isCompact && styles.statTitleCompact]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.statValue, isCompact && styles.statValueCompact]}>{item.value}</Text>
                      </View>
                      <Text style={[styles.statAccent, isCompact && styles.statAccentCompact]}>{item.accent}</Text>
                      <View style={[styles.statIcon, isCompact && styles.statIconCompact, { backgroundColor: `${item.color}1f` }]}>
                        <MaterialCommunityIcons name={item.icon as any} size={isCompact ? 25 : 40} color={item.color} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.panelList}>
                  {rows.map((row) => (
                  <TouchableOpacity key={row.title} activeOpacity={0.8} style={[styles.panelRow, isCompact && styles.panelRowCompact]}>
                      <View style={[styles.panelTitleWrap, isCompact && styles.panelTitleWrapCompact]}>
                        <MaterialCommunityIcons name={row.icon as any} size={24} color={row.color} />
                        <Text style={[styles.panelTitle, isCompact && styles.panelTitleCompact]}>{row.title}</Text>
                        <Text style={[styles.panelMeta, isCompact && styles.panelMetaCompact]}>{row.meta}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={24} color="#9aa0b2" />
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity activeOpacity={0.8} style={[styles.panelRow, styles.missionRow, isCompact && styles.missionRowCompact]}>
                    <View style={styles.missionIcon}>
                      <MaterialCommunityIcons name="chart-line" size={28} color="#5b85ff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.missionTitle, isCompact && styles.missionTitleCompact]}>LIVE MISSION CONTROL</Text>
                      <Text style={[styles.missionSub, isCompact && styles.missionSubCompact]}>REAL-TIME USER ENGAGEMENT</Text>
                    </View>
                    <View style={styles.livePill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={24} color="#9aa0b2" />
                  </TouchableOpacity>
                </View>
              </>
            ) : activeSection === 'Subscription Plans' ? (
              renderPlans()
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
  shellCompact: {
    flexDirection: 'column',
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
  topbarCompact: {
    height: 96,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchBoxCompact: {
    flex: 1,
    minWidth: 0,
    width: undefined,
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#f5f5f8',
    fontSize: 20,
    outlineStyle: 'none' as any,
  },
  searchInputCompact: {
    fontSize: 16,
  },
  statusWrap: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  statusWrapCompact: {
    marginLeft: 0,
    gap: 0,
  },
  hideOnCompact: {
    display: 'none',
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
  contentInnerCompact: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 32,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },
  headingRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 24,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 41,
    fontWeight: '900',
  },
  pageTitleCompact: {
    fontSize: 34,
    lineHeight: 38,
  },
  welcome: {
    color: '#9a9daa',
    fontSize: 20,
    fontWeight: '500',
  },
  welcomeCompact: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 35,
  },
  statsGridCompact: {
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
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
  statCardCompact: {
    width: '100%',
    minHeight: 96,
    padding: 16,
    borderRadius: 14,
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
  statTitleCompact: {
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 43,
    lineHeight: 51,
    fontWeight: '900',
  },
  statValueCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  statAccent: {
    color: '#49d58c',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 26,
    marginRight: 10,
  },
  statAccentCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginRight: 8,
  },
  statIcon: {
    width: 89,
    height: 89,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconCompact: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  panelList: {
    gap: 34,
  },
  planGrid: {
    gap: 18,
  },
  loadingWrap: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCard: {
    borderRadius: 8,
    backgroundColor: '#1b1b31',
    borderWidth: 1,
    borderColor: '#2b2b45',
    padding: 24,
  },
  planCardCompact: {
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 20,
  },
  planHeaderCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  planName: {
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  planMeta: {
    color: '#85899b',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
  savePlanBtn: {
    height: 42,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#49bd83',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePlanText: {
    color: '#071118',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  limitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planInputWrap: {
    minWidth: 132,
    flex: 1,
  },
  planInputLabel: {
    color: '#8f94a8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  planInput: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#33364d',
    backgroundColor: '#252538',
    color: '#f7f7fb',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    outlineStyle: 'none' as any,
  },
  planRule: {
    color: '#49d58c',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 16,
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
  panelRowCompact: {
    minHeight: 74,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  panelTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  panelTitleWrapCompact: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    color: '#f5f5fa',
    fontSize: 24,
    fontWeight: '900',
  },
  panelTitleCompact: {
    flex: 1,
    fontSize: 16,
  },
  panelMeta: {
    color: '#747788',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  panelMetaCompact: {
    display: 'none',
  },
  missionRow: {
    minHeight: 110,
    gap: 16,
    paddingLeft: 19,
  },
  missionRowCompact: {
    minHeight: 88,
    gap: 10,
    paddingLeft: 12,
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
  missionTitleCompact: {
    fontSize: 14,
    letterSpacing: 1,
  },
  missionSub: {
    color: '#777b8d',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
  },
  missionSubCompact: {
    fontSize: 10,
    letterSpacing: 1,
  },
  mobileNav: {
    backgroundColor: '#11111e',
    borderBottomWidth: 1,
    borderBottomColor: '#24243a',
    flexGrow: 0,
  },
  mobileNavContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  mobileNavItem: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1b1b31',
    borderWidth: 1,
    borderColor: '#2b2b45',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  mobileNavItemActive: {
    backgroundColor: '#49bd83',
    borderColor: '#49bd83',
  },
  mobileNavLabel: {
    color: '#d5d6df',
    fontSize: 12,
    fontWeight: '900',
    maxWidth: 128,
  },
  mobileNavLabelActive: {
    color: '#071118',
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
