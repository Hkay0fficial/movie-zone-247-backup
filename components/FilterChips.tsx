import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FilterChipsProps {
  filters: {
    vj: string | null;
    genre: string | null;
    type: string | null;
    year: string | null;
    rating: number;
    search: string;
  };
  onClear: (key: 'vj' | 'genre' | 'type' | 'year' | 'rating' | 'search') => void;
  onClearAll?: () => void;
  containerStyle?: any;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ filters, onClear, onClearAll, containerStyle }) => {
  const activeKeys = (Object.keys(filters) as Array<keyof FilterChipsProps['filters']>).filter(k => {
    if (k === 'rating') return filters[k] > 0;
    if (k === 'search') return filters[k] && filters[k].trim().length > 0;
    return !!filters[k];
  });

  if (activeKeys.length === 0) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.search ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('search')}>
            <Ionicons name="search" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.chipText}>"{filters.search}"</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {filters.vj ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('vj')}>
            <Text style={styles.chipLabel}>VJ:</Text>
            <Text style={styles.chipText}>{filters.vj}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {filters.genre ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('genre')}>
            <Text style={styles.chipText}>{filters.genre}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {filters.type ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('type')}>
            <Text style={styles.chipText}>{filters.type}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {filters.year ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('year')}>
            <Text style={styles.chipText}>{filters.year}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {filters.rating > 0 ? (
          <TouchableOpacity style={styles.chip} onPress={() => onClear('rating')}>
            <Ionicons name="star" size={12} color="#FFD700" style={{ marginRight: 4 }} />
            <Text style={styles.chipText}>{filters.rating}+</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}

        {activeKeys.length > 1 && onClearAll ? (
          <TouchableOpacity style={styles.clearAll} onPress={onClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 95, 239, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#5B5FEF',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    marginRight: 4,
    textTransform: 'uppercase',
  },
  clearAll: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  clearAllText: {
    color: '#5B5FEF',
    fontSize: 12,
    fontWeight: '600',
  },
});
