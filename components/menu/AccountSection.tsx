import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './menu.styles';
import { auth, db } from '../../constants/firebaseConfig';
import { deleteUser, signOut } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface AccountSectionProps {
  scrollRef?: any;
  selectedSubItem: string | null;
  setSelectedSubItem: (item: string | null) => void;
  selectedSecurityItem: string | null;
  setSelectedSecurityItem: (item: string | null) => void;
  savedScrollPosition: number;
  setSavedScrollPosition: (pos: number) => void;
  currentScrollY: number;
  userName: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  profilePhoto?: string;
  isEditingProfile: boolean;
  startEditing: () => void;
  saveProfile: () => void;
  cancelEditing: () => void;
  tempFirstName: string;
  setTempFirstName: (val: string) => void;
  tempLastName: string;
  setTempLastName: (val: string) => void;
  tempUsername: string;
  setTempUsername: (val: string) => void;
  tempPhoneNumber: string;
  setTempPhoneNumber: (val: string) => void;
  tempEmail: string;
  setTempEmail: (val: string) => void;
  handleChangePhoto: () => void;
  currentPass: string;
  setCurrentPass: (val: string) => void;
  newPass: string;
  setNewPass: (val: string) => void;
  confirmPass: string;
  setConfirmPass: (val: string) => void;
  passwordError: string;
  passUpdateSuccess: boolean;
  handleUpdatePassword: () => void;
  is2FAEnabled: boolean;
  is2FALoading: boolean;
  handleToggle2FA: () => void;
  activeDevices: any[];
  handleKickDevice: (id: string) => void;
  linkedAccounts: any;
  linkingProvider: string | null;
  handleLinkAccount: (provider: any) => void;
  userSecurityQuestion: string;
  setUserSecurityQuestion: (q: string) => void;
  userSecurityAnswer: string;
  setUserSecurityAnswer: (a: string) => void;
  isQuestionSaved: boolean;
  securityError: string;
  securitySaveSuccess: boolean;
  handleSaveSecurityQuestion: () => void;
  SECURITY_QUESTIONS: string[];
  SUB_ITEM_ICONS: Record<string, string>;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  selectedSubItem,
  setSelectedSubItem,
  selectedSecurityItem,
  setSelectedSecurityItem,
  savedScrollPosition,
  setSavedScrollPosition,
  currentScrollY,
  userName,
  userEmail,
  firstName,
  lastName,
  username,
  phoneNumber,
  isEditingProfile,
  startEditing,
  saveProfile,
  cancelEditing,
  tempFirstName,
  setTempFirstName,
  tempLastName,
  setTempLastName,
  tempUsername,
  setTempUsername,
  tempPhoneNumber,
  setTempPhoneNumber,
  tempEmail,
  setTempEmail,
  handleChangePhoto,
  currentPass,
  setCurrentPass,
  newPass,
  setNewPass,
  confirmPass,
  setConfirmPass,
  passwordError,
  passUpdateSuccess,
  handleUpdatePassword,
  is2FAEnabled,
  is2FALoading,
  handleToggle2FA,
  activeDevices,
  handleKickDevice,
  linkedAccounts,
  linkingProvider,
  handleLinkAccount,
  userSecurityQuestion,
  setUserSecurityQuestion,
  userSecurityAnswer,
  setUserSecurityAnswer,
  isQuestionSaved,
  securityError,
  securitySaveSuccess,
  handleSaveSecurityQuestion,
  SECURITY_QUESTIONS,
  SUB_ITEM_ICONS,
  scrollRef,
  profilePhoto,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');
  const [isDeleteFocused, setIsDeleteFocused] = React.useState(false);

  React.useEffect(() => {
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isDeleteFocused && scrollRef && scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
        setIsDeleteFocused(false);
      }
    });
    return () => hideSubscription.remove();
  }, [isDeleteFocused, scrollRef]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "You must be signed in to delete your account.");
        return;
      }
      
      // Clean up Firestore data
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (err) {
        console.warn("Could not delete user document from firestore:", err);
      }
      
      // Delete user from Firebase Auth
      await deleteUser(user);
      
      // Clear states and redirect
      setDeleteConfirmationText('');
      await AsyncStorage.removeItem('userToken');
      Alert.alert("Success", "Your account has been permanently deleted.");
      router.replace('/login');
      
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          "Security Verification Required", 
          "For your security, you must have signed in recently to delete your account. Please log out, log back in, and try again.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.trim().split(/\s+/);
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  // ── Account List ──
  if (!selectedSubItem) {
    return (
      <View style={styles.settingsContentSection}>
        <Text style={styles.settingsText}>Update your basic personal details and profile information.</Text>
        <View style={{ width: '100%', marginTop: 20, marginBottom: 20 }}>
          <View style={{
            position: 'absolute',
            top: 15,
            left: 15,
            right: 15,
            bottom: 15,
            backgroundColor: '#ffffff',
            borderRadius: 32,
            opacity: 0.15,
            zIndex: 0,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 25,
          }} />
          <View style={[styles.settingsList, {
            backgroundColor: 'rgba(30,30,45,0.98)',
            borderRadius: 32,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 12,
            overflow: 'hidden',
            paddingVertical: 10
          }]}>
            {[
              { label: 'Personal Info', icon: 'person-outline' },
              { label: 'Password & Security', icon: 'lock-closed-outline' },
            ].map((item, index, l) => (
              <TouchableOpacity 
                key={item.label} 
                style={[
                  styles.settingsRow, 
                  index === l.length - 1 && { borderBottomWidth: 0 }
                ]} 
                onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSubItem(item.label); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Ionicons name={item.icon as any} size={20} color="#818cf8" />
                  <Text style={styles.settingsRowText}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
              </TouchableOpacity>
            ))}
            <View style={{ height: 1.5, backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16 }} />
            <TouchableOpacity
              style={[styles.settingsRow, { borderBottomWidth: 0, paddingTop: 20 }]}
              onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSubItem('Delete Account'); }}
            >
              <Text style={[styles.settingsRowText, { color: '#ef4444' }]}>Delete Account</Text>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Personal Info ──
  if (selectedSubItem === 'Personal Info') {
    if (userName === 'Guest Mode' || userEmail === 'Sign in to save your history') {
      return (
        <View style={{ width: '100%', marginTop: 20 }}>
          <View style={{
            position: 'absolute',
            top: 15,
            left: 15,
            right: 15,
            bottom: 15,
            backgroundColor: '#ffffff',
            borderRadius: 32,
            opacity: 0.15,
            zIndex: 0,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 25,
          }} />
          <View style={{
            backgroundColor: 'rgba(30,30,45,0.98)',
            borderRadius: 32,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 12,
            overflow: 'hidden',
            padding: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="person-circle-outline" size={80} color="#64748b" />
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 }}>Guest Mode Active</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 }}>
              You are currently browsing as a guest. Sign in or create an account to update your profile, customize preferences, and sync your history.
            </Text>
            <TouchableOpacity 
              style={[styles.piSaveBtn, { width: '100%', paddingVertical: 14 }]} 
              onPress={() => router.replace('/login')}
            >
              <LinearGradient colors={['#5B5FEF', '#4A4ED1']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
              <Text style={styles.piSaveBtnText}>Sign In / Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.settingsContentSection}>
        <View style={{ width: '100%', marginTop: 20, marginBottom: 20 }}>
          <View style={{
            position: 'absolute',
            top: 15,
            left: 15,
            right: 15,
            bottom: 15,
            backgroundColor: '#ffffff',
            borderRadius: 32,
            opacity: 0.15,
            zIndex: 0,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 25,
          }} />
          <View style={{
            backgroundColor: 'rgba(30,30,45,0.98)',
            borderRadius: 32,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 12,
            overflow: 'hidden',
            padding: 20,
          }}>
            <View style={[styles.compactProfileHeader, { marginBottom: 20 }]}>
              <TouchableOpacity style={styles.compactAvatarWrapper} activeOpacity={0.7} onPress={handleChangePhoto}>
                {!imageError ? (
                  <Image 
                    source={{ uri: profilePhoto || "" }} 
                    style={styles.compactAvatar} 
                    onError={() => setImageError(true)} 
                  />
                ) : (
                  <View style={[styles.compactAvatar, { backgroundColor: 'rgba(30, 30, 45, 0.98)', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900', letterSpacing: 1 }}>
                      {getInitials(userName)}
                    </Text>
                  </View>
                )}
                <LinearGradient colors={['#5B5FEF', '#3d44ff']} style={styles.avatarMiniBadge}>
                  <Ionicons name="camera" size={10} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.headerDisplayName}>{userName}</Text>
                <Text style={styles.headerEmail}>{userEmail}</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.piInfoCardGroup}>
                <Text style={styles.piInfoGroupTitle}>Identity</Text>
                <View style={[styles.piInfoCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.05)' }]}>
                  {[
                    { label: 'Username', value: `@${username}`, temp: tempUsername, set: setTempUsername, icon: 'at-outline' },
                  ].map((field) => (
                    <View key={field.label} style={[styles.piInfoRow, styles.piNoBorder]}>
                      <Ionicons name={field.icon as any} size={18} color="#818cf8" style={styles.piInfoIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.piInfoLabel}>{field.label}</Text>
                        {isEditingProfile ? (
                          <TextInput
                            style={styles.piInfoInput}
                            value={field.temp}
                            onChangeText={field.set}
                            placeholder={field.label}
                            placeholderTextColor="rgba(255,255,255,0.2)"
                            autoCapitalize="none"
                          />
                        ) : (
                          <Text style={styles.piInfoValue}>{field.value}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                  
                  <View style={styles.piNameGrid}>
                    {[
                      { label: 'First Name', value: firstName, temp: tempFirstName, set: setTempFirstName },
                      { label: 'Last Name', value: lastName, temp: tempLastName, set: setTempLastName },
                    ].map((field) => (
                      <View key={field.label} style={styles.piGridItem}>
                        <Text style={styles.piInfoLabel}>{field.label}</Text>
                        {isEditingProfile ? (
                          <TextInput
                            style={styles.piInfoInput}
                            value={field.temp}
                            onChangeText={field.set}
                            placeholder={field.label}
                            placeholderTextColor="rgba(255,255,255,0.2)"
                          />
                        ) : (
                          <Text style={styles.piInfoValue}>{field.value}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.piInfoCardGroup}>
                <Text style={styles.piInfoGroupTitle}>Contact Details</Text>
                <View style={[styles.piInfoCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.05)' }]}>
                  <View style={styles.piInfoRow}>
                    <Ionicons name="mail-outline" size={18} color="#818cf8" style={styles.piInfoIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.piInfoLabel}>Email Address</Text>
                      {isEditingProfile ? (
                        <TextInput
                          style={styles.piInfoInput}
                          value={tempEmail}
                          onChangeText={setTempEmail}
                          placeholder="Email"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      ) : (
                        <Text style={styles.piInfoValue}>{userEmail}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.piInfoRow, styles.piNoBorder]}>
                    <Ionicons name="call-outline" size={18} color="#818cf8" style={styles.piInfoIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.piInfoLabel}>Phone Number</Text>
                      {isEditingProfile ? (
                        <TextInput
                          style={styles.piInfoInput}
                          value={tempPhoneNumber}
                          onChangeText={setTempPhoneNumber}
                          placeholder="Phone"
                          keyboardType="phone-pad"
                        />
                      ) : (
                        <Text style={styles.piInfoValue}>{phoneNumber || 'Link your phone'}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {!isEditingProfile ? (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                   <View style={[styles.piMetadataPill, { flex: 1, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.05)' }]}>
                     <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.4)" />
                     <Text style={styles.piMetadataText}>Member Since: March 2024</Text>
                   </View>

                  <TouchableOpacity 
                    style={[styles.piMainEditBtnWrapper, { flex: 1, marginTop: 0, marginBottom: 0 }]} 
                    onPress={startEditing}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.piMainEditBtn, { height: 44, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' }]}>
                      <Ionicons name="create-outline" size={16} color="#fff" />
                      <Text style={styles.piMainEditBtnText}>Edit Profile</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.piEditActionsRow}>
                  <TouchableOpacity style={styles.piCancelBtn} onPress={cancelEditing}>
                    <Text style={styles.piCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.piSaveBtnWrapper} onPress={saveProfile}>
                    <LinearGradient colors={['#5B5FEF', '#4A4ED1']} style={styles.piSaveBtn}>
                      <Text style={styles.piSaveBtnText}>Save Changes</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // ── Password & Security ──
  if (selectedSubItem === 'Password & Security') {
    return (
      <View style={styles.settingsContentSection}>
        {!selectedSecurityItem && <Text style={styles.settingsText}>Manage your password, security settings, and login protection.</Text>}

        {!selectedSecurityItem ? (
          <View style={{ width: '100%', marginBottom: 20, marginTop: 10 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 32, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.settingsList, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderRadius: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, overflow: 'hidden', paddingVertical: 10 }]}>
              <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Change Password'); }}>
                <Text style={styles.settingsRowText}>Change Password</Text>
                <Ionicons name="lock-closed" size={14} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Two-Factor Authentication'); }}>
                <Text style={styles.settingsRowText}>Two-Factor Authentication</Text>
                <Ionicons name="shield-checkmark" size={14} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Login Activity'); }}>
                <Text style={styles.settingsRowText}>Login Activity</Text>
                <Ionicons name="time" size={14} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Password Recovery'); }}>
                <Text style={styles.settingsRowText}>Password Recovery</Text>
                <Ionicons name="key-outline" size={14} color="#818cf8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => { setSavedScrollPosition(currentScrollY); setSelectedSecurityItem('Linked Accounts'); }}>
                <Text style={styles.settingsRowText}>Linked Accounts</Text>
                <Ionicons name="link-outline" size={14} color="#34d399" />
              </TouchableOpacity>
            </View>
          </View>
        ) : selectedSecurityItem === 'Change Password' ? (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
              {passUpdateSuccess && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#34d399" />
                  <Text style={styles.successText}>Password updated successfully!</Text>
                </View>
              )}
              <Text style={styles.securityTitle}>Change Password</Text>
              <Text style={styles.securityDesc}>Ensure your new password is at least 8 characters long and includes a mix of letters and numbers.</Text>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Password</Text>
                  <TextInput
                    style={styles.editInput}
                    value={currentPass}
                    onChangeText={setCurrentPass}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>New Password</Text>
                  <TextInput
                    style={styles.editInput}
                    value={newPass}
                    onChangeText={setNewPass}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Confirm New Password</Text>
                  <TextInput
                    style={styles.editInput}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                  />
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>

              <TouchableOpacity style={[styles.requestCodeBtn, { marginTop: 24 }]} onPress={handleUpdatePassword}>
                <Text style={styles.requestCodeText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : selectedSecurityItem === 'Two-Factor Authentication' ? (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
              <Text style={styles.securityTitle}>Two-Factor Authentication</Text>
              <Text style={styles.securityDesc}>Add an extra layer of security to your account by requiring a code from your phone in addition to your password.</Text>

              <TouchableOpacity
                style={styles.tfaToggleBox}
                activeOpacity={0.8}
                onPress={handleToggle2FA}
                disabled={is2FALoading}
              >
                <Text style={styles.tfaLabel}>2FA Status</Text>
                {is2FALoading ? (
                  <View style={{ width: 100, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#64748b', fontSize: 10 }}>UPDATING...</Text>
                  </View>
                ) : (
                  <Text style={[styles.tfaStatus, is2FAEnabled && { color: '#34d399' }]}>
                    {is2FAEnabled ? 'ENABLED' : 'DISABLED'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.deletionWarningBox}>
                <Text style={[styles.deletionDesc, { marginBottom: 0 }]}>
                  We highly recommend enabling 2FA to protect your account from unauthorized access.
                </Text>
              </View>
            </View>
          </View>
        ) : selectedSecurityItem === 'Login Activity' ? (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
              <Text style={styles.securityTitle}>Recent Login Activity</Text>
              <Text style={styles.securityDesc}>Check the devices where you're currently logged in or have recently accessed your account.</Text>

              <View style={{ gap: 8 }}>
                {activeDevices.map((session) => (
                  <View key={session.id} style={styles.sessionItem}>
                    <View style={styles.sessionIcon}>
                      <Ionicons
                        name={session.device.includes('iPhone') || session.device.includes('Phone') ? 'phone-portrait-outline' as any : session.device.includes('Mac') || session.device.includes('desktop') ? 'desktop-outline' as any : 'laptop-outline' as any}
                        size={24}
                        color={session.current ? "#10b981" : "#818cf8"}
                      />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionDevice}>{session.device}</Text>
                      <Text style={styles.sessionDetails}>{session.location} • {session.time}</Text>
                    </View>
                    {session.current ? (
                      <Text style={styles.currentStatus}>Active</Text>
                    ) : (
                      <TouchableOpacity onPress={() => handleKickDevice(session.id)}>
                        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : selectedSecurityItem === 'Password Recovery' ? (
          <View style={styles.settingsContentSection}>
            <Text style={styles.settingsText}>Select a registered method to recover your password access.</Text>

            <View style={{ width: '100%', marginBottom: 20, marginTop: 10 }}>
              <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 32, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
              <View style={[styles.settingsList, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderRadius: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, overflow: 'hidden', paddingVertical: 10 }]}>
                {[
                  { id: 'google', label: 'Registered Google', icon: 'logo-google', color: '#ea4335', detail: linkedAccounts.google ? 'Account Linked - Ready for Recovery' : 'Recovery via linked Google Account' },
                  { id: 'phone', label: 'Phone Numbers', icon: 'phone-portrait-outline', color: '#34d399', detail: 'Recovery via SMS verification' },
                  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877f2', detail: linkedAccounts.facebook ? 'Account Linked - Ready for Recovery' : 'Recovery via Facebook Auth' },
                  { id: 'apple', label: 'Apple ID', icon: 'logo-apple', color: '#fff', detail: linkedAccounts.apple ? 'Account Linked - Ready for Recovery' : 'Recovery via Apple Secure Link' },
                  { id: 'security', label: 'Security Questions', icon: 'help-buoy-outline', color: '#818cf8', detail: isQuestionSaved ? 'Questions Set - Ready for Recovery' : 'Recovery via personal questions' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.label}
                    style={styles.settingsRow}
                    onPress={() => {
                      if (method.label === 'Security Questions') {
                        setSavedScrollPosition(currentScrollY);
                        setSelectedSecurityItem('Security Questions');
                      } else {
                        alert(`Password recovery link sent to your registered ${method.label}`);
                      }
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.menuIcon, { backgroundColor: method.color + '18', width: 32, height: 32 }]}>
                        <Ionicons name={method.icon as any} size={16} color={method.color} />
                      </View>
                      <View>
                        <Text style={styles.settingsRowText}>{method.label}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>{method.detail}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#475569" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : selectedSecurityItem === 'Linked Accounts' ? (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
              <Text style={styles.securityTitle}>Linked Accounts</Text>
              <Text style={styles.securityDesc}>Manage your connected social login providers to enable quick and easy access to your account.</Text>

              <View style={{ gap: 12, marginTop: 10 }}>
                {[
                  { id: 'google', label: 'Google', icon: 'logo-google', color: '#ea4335' },
                  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877f2' },
                  { id: 'apple', label: 'Apple ID', icon: 'logo-apple', color: '#fff' },
                ].map((social) => (
                  <TouchableOpacity 
                    key={social.label} 
                    style={styles.socialLinkBtn}
                    onPress={() => handleLinkAccount(social.id as any)}
                    disabled={linkingProvider !== null}
                  >
                    {linkingProvider === social.id ? (
                      <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 10 }} />
                    ) : (
                      <Ionicons name={social.icon as any} size={20} color={social.color} />
                    )}
                    <Text style={[styles.socialLinkText, linkedAccounts[social.id as keyof typeof linkedAccounts] && { color: '#f1f5f9' }, { fontSize: 14, marginLeft: 6 }]}>
                      {linkingProvider === social.id ? 'Connecting...' : linkedAccounts[social.id as keyof typeof linkedAccounts] ? `Unlink ${social.label}` : `Link ${social.label}`}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.linkStatus, { color: linkedAccounts[social.id as keyof typeof linkedAccounts] ? '#10b981' : '#475569', fontSize: 11, fontWeight: '700' }]}>
                      {linkedAccounts[social.id as keyof typeof linkedAccounts] ? 'LINKED' : 'UNLINKED'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : selectedSecurityItem === 'Security Questions' ? (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
            <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 }]}>
              {securitySaveSuccess && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={20} color="#34d399" />
                  <Text style={styles.successText}>Security question saved successfully!</Text>
                </View>
              )}
              <Text style={styles.securityTitle}>Security Questions</Text>
              <Text style={styles.securityDesc}>Set a security question to help recover your account if you forget your password.</Text>

              {isQuestionSaved && !securitySaveSuccess ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Question</Text>
                    <Text style={[styles.detailValue, { color: '#f1f5f9', fontSize: 13, fontWeight: '700' }]}>{userSecurityQuestion}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Answer</Text>
                    <Text style={[styles.detailValue, { color: '#64748b', fontSize: 13 }]}>••••••••</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.requestCodeBtn, { marginTop: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' }]} 
                    onPress={() => setSelectedSecurityItem('Password Recovery')} // Back to recovery
                  >
                    <Text style={[styles.requestCodeText, { color: '#94a3b8' }]}>Back to Recovery Models</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.detailCard}>
                  <Text style={[styles.detailLabel, { marginBottom: 12 }]}>Choose a question:</Text>
                  <View style={{ gap: 10, marginBottom: 24 }}>
                    {SECURITY_QUESTIONS.map((q) => (
                      <TouchableOpacity
                        key={q}
                        style={{
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: userSecurityQuestion === q ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: userSecurityQuestion === q ? '#818cf8' : 'rgba(255,255,255,0.05)',
                        }}
                        onPress={() => setUserSecurityQuestion(q)}
                      >
                        <Text style={{ color: userSecurityQuestion === q ? '#818cf8' : '#94a3b8', fontSize: 13, fontWeight: '600' }}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Your Answer</Text>
                    <TextInput
                      style={styles.editInput}
                      value={userSecurityAnswer}
                      onChangeText={setUserSecurityAnswer}
                      placeholder="Type your answer here..."
                      placeholderTextColor="#64748b"
                    />
                  </View>
                  {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}

                  <TouchableOpacity style={[styles.requestCodeBtn, { marginTop: 24 }]} onPress={handleSaveSecurityQuestion}>
                    <Text style={styles.requestCodeText}>Save Security Question</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Delete Account ──
  if (selectedSubItem === 'Delete Account') {
    return (
      <View style={styles.settingsContentSection}>
        <Text style={styles.settingsText}>Deleting your account is permanent and cannot be undone.</Text>
        
        <View style={{ width: '100%', marginBottom: 30, marginTop: -4 }}>
          <View style={{ position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, backgroundColor: '#ffffff', borderRadius: 24, opacity: 0.15, shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 25 }} />
          <View style={[styles.securityCard, { backgroundColor: 'rgba(30, 30, 45, 0.98)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239, 68, 68, 0.3)', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="warning-outline" size={48} color="#ef4444" />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 }}>Danger Zone</Text>
            </View>

            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 16, borderRadius: 16, marginBottom: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239, 68, 68, 0.1)' }}>
              <Text style={{ color: '#fca5a5', fontSize: 12, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Consequences of Deletion</Text>
              
              {[
                'Your premium subscription will be immediately canceled without refund.',
                'All offline downloads and saved movies will be erased from your device.',
                'Personal data, preferences, sync progress, and favorites will be permanently deleted.'
              ].map((step, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '900', marginTop: -1 }}>•</Text>
                  <Text style={{ color: '#f87171', fontSize: 13, lineHeight: 18, flex: 1 }}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ width: '100%', marginBottom: Platform.OS === 'ios' ? 250 : 250, paddingHorizontal: 10 }}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To confirm, type "DELETE" below:</Text>
            <TextInput
              style={[styles.editInput, { 
                borderColor: deleteConfirmationText === 'DELETE' ? '#34d399' : 'rgba(239, 68, 68, 0.3)', 
                color: '#fff',
                borderWidth: StyleSheet.hairlineWidth,
                textAlign: 'center',
                fontSize: 18,
                letterSpacing: 2
              }]}
              value={deleteConfirmationText}
              onChangeText={setDeleteConfirmationText}
              onFocus={() => {
                setIsDeleteFocused(true);
                if (scrollRef && scrollRef.current) {
                  // Fire multiple times to catch Android's delayed keyboard resize animation perfectly
                  scrollRef.current.scrollToEnd({ animated: true });
                  setTimeout(() => {
                    if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
                  }, 300);
                  setTimeout(() => {
                    if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
                  }, 600);
                }
              }}
              onBlur={() => {
                setIsDeleteFocused(false);
                if (scrollRef && scrollRef.current) {
                  scrollRef.current.scrollTo({ y: 0, animated: true });
                }
              }}
              placeholder="DELETE"
              placeholderTextColor="rgba(255,255,255,0.15)"
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity 
            style={[
              styles.requestCodeBtn, 
              { 
                marginTop: 24, 
                backgroundColor: deleteConfirmationText === 'DELETE' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)', 
                borderWidth: 0,
                shadowColor: deleteConfirmationText === 'DELETE' ? '#ef4444' : 'transparent',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 }
              }
            ]} 
            disabled={deleteConfirmationText !== 'DELETE'}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.requestCodeText, { color: deleteConfirmationText === 'DELETE' ? '#fff' : 'rgba(255,255,255,0.4)' }]}>
              Permanently Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};
