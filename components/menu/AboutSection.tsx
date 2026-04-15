import { View, Text } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { styles } from './menu.styles';

interface AboutSectionProps {
  selectedItem: { id: string; title: string } | null;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ selectedItem }) => {
  if (selectedItem?.id !== '9') return null;

  return (
    <View style={styles.settingsContentSection}>
      <Text style={styles.settingsText}>Information about the app and legal notices.</Text>
      
      <View style={{ marginTop: 24, gap: 16 }}>
        <View style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderLeftWidth: 3, borderLeftColor: '#818cf8' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Version {Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.1.0'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Build {Application.nativeBuildVersion}</Text>
        </View>

        <View style={{ padding: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Legal & Privacy</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 }}>
            By using THE MOVIE ZONE 24/7, you agree to our Terms of Service and Privacy Policy. All content is licensed under respective owners.
          </Text>
        </View>
      </View>
    </View>
  );
};
