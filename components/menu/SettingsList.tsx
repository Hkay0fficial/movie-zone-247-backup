import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './menu.styles';

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
}

interface SettingsListProps {
  menuItems: MenuItem[];
  userEmail: string;
  onItemPress: (item: MenuItem) => void;
  onAdminPress: () => void;
  onAboutPress: () => void;
}

export const SettingsList: React.FC<SettingsListProps> = ({
  menuItems,
  userEmail,
  onItemPress,
  onAdminPress,
  onAboutPress
}) => {
  const filteredItems = menuItems.filter(
    item => item.id !== 'admin' || userEmail?.toLowerCase() === 'sserunkumaharuna01@gmail.com'
  );

  return (
    <View style={{ width: '100%', marginTop: 0, marginBottom: 20 }}>
      {/* White Background Glow */}
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
        backgroundColor: 'rgba(30, 30, 45, 0.98)',
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
        overflow: 'hidden',
        paddingVertical: 10
      }]}>
        {filteredItems.map((item, i) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.settingsRow,
              i === filteredItems.length - 1 && { borderBottomWidth: 0 },
            ]}
            activeOpacity={0.65}
            onPress={() => {
              if (item.id === 'admin') {
                onAdminPress();
              } else if (item.title === 'About') {
                onAboutPress();
              } else {
                onItemPress(item);
              }
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.settingsRowText}>{item.title}</Text>
                <Text style={styles.menuSub}>{item.subtitle}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
