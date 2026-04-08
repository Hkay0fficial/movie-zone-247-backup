const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/(tabs)/menu.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `{FAVOURITES.map((m) => (
                        <TouchableOpacity key={m.id} style={styles.gridCard} activeOpacity={0.8}>
                          <View>
                            <Image source={{ uri: m.poster }} style={styles.gridPoster} />
                            <View style={styles.vjBadgeSmall}>
                              <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                            </View>
                            <View style={styles.genreBadgeSmall}>
                              <Text style={styles.genreBadgeTextSmall}>
                                {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.gridInfo}>
                            <Text style={styles.gridTitle} numberOfLines={1}>{m.title}</Text>
                            <Text style={styles.gridMeta} numberOfLines={1}>
                              {m.year} · {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : \`Season \${m.seasons}\`) : m.duration}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}`;

const replacementStr = `{favorites.length > 0 ? (
                        favorites.map((m) => (
                          <TouchableOpacity 
                            key={m.id} 
                            style={styles.gridCard} 
                            activeOpacity={0.8}
                            onPress={() => {
                              if ("seasons" in m) {
                                router.push({ pathname: "/(tabs)/saved", params: { seriesId: m.id } });
                              } else {
                                router.push({ pathname: "/(tabs)/saved", params: { movieId: m.id } });
                              }
                            }}
                          >
                            <View>
                              <Image source={{ uri: m.poster }} style={styles.gridPoster} />
                              <View style={styles.vjBadgeSmall}>
                                <Text style={styles.vjBadgeTextSmall}>{m.vj}</Text>
                              </View>
                              <View style={styles.genreBadgeSmall}>
                                <Text style={styles.genreBadgeTextSmall}>
                                  {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : "Series") : shortenGenre(m.genre)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.gridInfo}>
                              <Text style={styles.gridTitle} numberOfLines={1}>{m.title}</Text>
                              <Text style={styles.gridMeta} numberOfLines={1}>
                                {m.year} · {("seasons" in m) ? ((m as unknown as Series).isMiniSeries ? "Mini Series" : \`Season \${m.seasons}\`) : m.duration}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={{ width: SCREEN_W - 80, padding: 40, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20, marginTop: 20 }}>
                          <Ionicons name="bookmark-outline" size={48} color="rgba(255,255,255,0.1)" />
                          <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 14, textAlign: 'center' }}>Your list is empty. Save movies to watch them later!</Text>
                        </View>
                      )}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Success: menu.tsx updated securely.');
} else {
  console.log('Error: target string not found.');
}
