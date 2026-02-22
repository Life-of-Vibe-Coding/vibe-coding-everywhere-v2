import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Keyboard,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useTheme } from "../../theme/index";
import { UrlChoiceModal } from "./UrlChoiceModal";

const PREVIEW_TABS_KEY = "@vibe_preview_tabs";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function genTabId(): string {
  return "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

/** Strip our cache-bust param so storing this URL doesn't cause loadUri to change every time and trigger reload loop. */
function stripPreviewParam(href: string): string {
  try {
    const u = new URL(href);
    u.searchParams.delete("_preview");
    const out = u.toString();
    return out.endsWith("?") ? out.slice(0, -1) : out;
  } catch {
    return href.replace(/([?&])_preview=[^&]*&?/g, (_, p) => (p === "?" ? "" : p)).replace(/\?$/, "");
  }
}

interface PreviewWebViewModalProps {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
  /** Resolver for localhost/127.0.0.1 -> Tailscale (EXPO_PUBLIC_PREVIEW_HOST). When set, prompts user to use VPN URL when localhost is detected. */
  resolvePreviewUrl?: (url: string) => string;
}

interface TabState {
  id: string;
  url: string;
  loadKey: number;
}

export function PreviewWebViewModal({
  visible,
  url,
  title = "Preview",
  onClose,
  resolvePreviewUrl,
}: PreviewWebViewModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createPreviewStyles(theme), [theme]);
  const [tabs, setTabs] = useState<TabState[]>(() => []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [urlChoiceVisible, setUrlChoiceVisible] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const pendingUrlChoice = useRef<{ normalized: string; thenApply: (u: string) => void } | null>(null);
  const initializedRef = useRef(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // Auto full screen only when phone is rotated to landscape (90°); portrait shows toolbar
  useEffect(() => {
    if (!visible) return;
    setIsFullScreen(isLandscape);
  }, [visible, isLandscape]);

  const currentTab = tabs[activeIndex] ?? null;
  const currentUrl = currentTab?.url ?? "";

  const applyUrl = (u: string) => {
    setTabs((prev) => {
      const next = [...prev];
      const tab = next[activeIndex];
      if (tab) {
        next[activeIndex] = { ...tab, url: u, loadKey: Date.now() };
      }
      return next;
    });
    setUrlInputValue(u);
    setError(null);
    setLoading(true);
  };

  const promptLocalhostToVpn = (normalized: string, thenApply: (u: string) => void) => {
    if (!resolvePreviewUrl || !isLocalhostUrl(normalized)) {
      thenApply(normalized);
      return;
    }
    pendingUrlChoice.current = { normalized, thenApply };
    setUrlChoiceVisible(true);
  };

  const handleUrlChoiceVpn = () => {
    const p = pendingUrlChoice.current;
    if (p && resolvePreviewUrl) {
      p.thenApply(resolvePreviewUrl(p.normalized));
    }
    pendingUrlChoice.current = null;
    setUrlChoiceVisible(false);
  };

  const handleUrlChoiceOriginal = () => {
    const p = pendingUrlChoice.current;
    if (p) {
      p.thenApply(p.normalized);
      pendingUrlChoice.current = null;
      setUrlChoiceVisible(false);
    }
  };

  const handleUrlChoiceCancel = () => {
    pendingUrlChoice.current = null;
    setUrlChoiceVisible(false);
  };

  useEffect(() => {
    if (!visible) {
      initializedRef.current = false;
      setIsFullScreen(false);
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      const initialUrl = (url?.trim() ?? "") || "";
      const normalized = initialUrl ? normalizeUrl(initialUrl) : "";

      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PREVIEW_TABS_KEY);
          const stored = raw ? (JSON.parse(raw) as { tabs: { id: string; url: string }[]; activeIndex: number }) : null;
          if (stored?.tabs?.length) {
            const restored: TabState[] = stored.tabs.map((t) => ({ ...t, loadKey: t.url ? Date.now() : 0 }));
            const idx = Math.min(Math.max(0, stored.activeIndex ?? 0), restored.length - 1);
            setTabs(restored);
            setActiveIndex(idx);
            setUrlInputValue(restored[idx]?.url ?? "");
            setError(null);
            setLoading(!!restored[idx]?.url);
            return;
          }
        } catch {
          // Fall through to url-based init
        }

        const willShowChoice = !!normalized && !!resolvePreviewUrl && isLocalhostUrl(normalized);
        if (willShowChoice) {
          setTabs([{ id: genTabId(), url: "", loadKey: 0 }]);
          setActiveIndex(0);
          setUrlInputValue(normalized);
          setError(null);
          setLoading(false);
          pendingUrlChoice.current = {
            normalized,
            thenApply: (resolved: string) => {
              setTabs((prev) => {
                const next = [...prev];
                if (next[0]) next[0] = { ...next[0], url: resolved, loadKey: Date.now() };
                return next;
              });
              setUrlInputValue(resolved);
              setLoading(true);
            },
          };
          setUrlChoiceVisible(true);
        } else if (normalized) {
          setTabs([{ id: genTabId(), url: normalized, loadKey: Date.now() }]);
          setActiveIndex(0);
          setUrlInputValue(normalized);
          setError(null);
          setLoading(true);
        } else {
          setTabs([{ id: genTabId(), url: "", loadKey: 0 }]);
          setActiveIndex(0);
          setUrlInputValue("");
          setError(null);
          setLoading(false);
        }
      })();
    }
  }, [visible, url, resolvePreviewUrl]);

  useEffect(() => {
    if (!visible || tabs.length === 0) return;
    const payload = {
      tabs: tabs.map((t) => ({ id: t.id, url: t.url })),
      activeIndex,
    };
    AsyncStorage.setItem(PREVIEW_TABS_KEY, JSON.stringify(payload)).catch(() => {});
  }, [visible, tabs, activeIndex]);

  const handleGo = () => {
    Keyboard.dismiss();
    const raw = urlInputValue.trim();
    if (!raw) return;
    const normalized = normalizeUrl(raw);
    promptLocalhostToVpn(normalized, applyUrl);
  };

  const handleReload = () => {
    Keyboard.dismiss();
    const raw = urlInputValue.trim();
    if (raw) {
      const normalized = normalizeUrl(raw);
      const currentClean = stripPreviewParam(resolvedUrl) || resolvedUrl;
      if (normalized !== currentClean) {
        promptLocalhostToVpn(normalized, applyUrl);
        return;
      }
    }
    if (!resolvedUrl) return;
    setError(null);
    setLoading(true);
    setTabs((prev) => {
      const next = [...prev];
      const tab = next[activeIndex];
      if (tab) next[activeIndex] = { ...tab, loadKey: Date.now() };
      return next;
    });
  };

  const handleNavigationStateChange = (navState: { url?: string }, tabIndex: number) => {
    if (navState.url) {
      const clean = stripPreviewParam(navState.url);
      setTabs((prev) => {
        const next = [...prev];
        const tab = next[tabIndex];
        if (tab) next[tabIndex] = { ...tab, url: clean };
        return next;
      });
      if (tabIndex === activeIndex) setUrlInputValue(clean);
    }
  };

  const addTab = () => {
    const newTab: TabState = { id: genTabId(), url: "", loadKey: 0 };
    setTabs((prev) => [...prev, newTab]);
    setActiveIndex(tabs.length);
    setUrlInputValue("");
    setError(null);
    setLoading(false);
  };

  const closeTab = (index: number) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((_, i) => i !== index);
    const nextActive =
      activeIndex === index ? (index > 0 ? index - 1 : 0) : activeIndex > index ? activeIndex - 1 : activeIndex;
    setTabs(nextTabs);
    setActiveIndex(nextActive);
    setUrlInputValue(nextTabs[nextActive]?.url ?? "");
  };

  const selectTab = (index: number) => {
    setActiveIndex(index);
    setUrlInputValue(tabs[index]?.url ?? "");
    setError(null);
  };

  if (!visible) return null;

  const resolvedUrl = currentUrl || "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
    >
      <View style={styles.safe}>
        {/* Chrome-like toolbar - hidden in full screen */}
        {!isFullScreen && (
          <>
            {/* Row 1: Close button | Tabs | Add tab */}
            <View style={[styles.toolbar, { paddingTop: insets.top }]}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityLabel="Close preview"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabBarContent}
                style={styles.tabBarScroll}
              >
                {tabs.map((tab, i) => {
                  const isActive = i === activeIndex;
                  const label = `tab ${i + 1}`;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => selectTab(i)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                        {label}
                      </Text>
                      {tabs.length > 1 && (
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.tabClose}
                          onPress={(e) => {
                            e.stopPropagation();
                            closeTab(i);
                          }}
                        >
                          <Text style={[styles.tabCloseText, isActive && styles.tabCloseTextActive]}>×</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.addTabBtn} onPress={addTab} activeOpacity={0.8}>
                <Text style={styles.addTabText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Address bar | Refresh | Fullscreen */}
            <View style={styles.tabBar}>
              <View style={styles.urlBarWrap}>
                <TextInput
                  style={styles.urlInput}
                  value={urlInputValue}
                  onChangeText={setUrlInputValue}
                  placeholder="搜索或输入网址"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleGo}
                  selectTextOnFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.iconBtn, loading && !!resolvedUrl && styles.iconBtnDisabled]}
                onPress={handleReload}
                disabled={loading && !!resolvedUrl}
                activeOpacity={0.8}
                accessibilityLabel="Reload"
              >
                {loading && resolvedUrl ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={styles.iconBtnText}>↵</Text>
                )}
              </TouchableOpacity>
              {!!resolvedUrl && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setIsFullScreen(true)}
                  activeOpacity={0.8}
                  accessibilityLabel="Full screen"
                >
                  <Text style={styles.iconBtnText}>⛶</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {!resolvedUrl ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>输入网址后按键盘「前往」或点击刷新加载</Text>
          </View>
        ) : (
          <View style={styles.webContainer}>
            {/* Render one WebView per tab so switching tabs does not remount/reload. */}
            {tabs.map((tab, i) => {
              const tabUrl = tab.url ?? "";
              const tabBaseUrl = tabUrl ? stripPreviewParam(tabUrl) : "";
              const tabLoadUri =
                tabUrl && tab.loadKey
                  ? tabBaseUrl + (tabBaseUrl.includes("?") ? "&" : "?") + "_preview=" + tab.loadKey
                  : "";
              const isActive = i === activeIndex;
              if (!tabLoadUri) return null;
              return (
                <View
                  key={tab.id}
                  style={[
                    styles.webviewWrapper,
                    !isActive && styles.webviewWrapperHidden,
                  ]}
                  pointerEvents={isActive ? "auto" : "none"}
                >
                  <WebView
                    ref={isActive ? webViewRef : undefined}
                    key={tab.loadKey ? `${tab.loadKey}-${tabBaseUrl}` : tabUrl}
                    source={{ uri: tabLoadUri }}
                    style={styles.webview}
                    onLoadStart={() => {
                      if (i === activeIndex) {
                        setLoading(true);
                        setError(null);
                      }
                    }}
                    onLoadEnd={() => {
                      if (i === activeIndex) setLoading(false);
                    }}
                    onError={(e) => {
                      if (i === activeIndex) {
                        setLoading(false);
                        const desc = e.nativeEvent?.description ?? "加载失败";
                        setError(desc);
                      }
                    }}
                    onHttpError={(e) => {
                      if (i === activeIndex) {
                        setLoading(false);
                        const status = e.nativeEvent?.statusCode;
                        setError(status ? `HTTP ${status}` : "加载失败");
                      }
                    }}
                    onNavigationStateChange={(navState) => {
                      if (navState.url) handleNavigationStateChange(navState, i);
                    }}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    scalesPageToFit
                    mixedContentMode="compatibility"
                    cacheEnabled={false}
                    {...(Platform.OS === "android" ? { cacheMode: "LOAD_NO_CACHE" as const } : {})}
                  />
                </View>
              );
            })}
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>加载中…</Text>
              </View>
            )}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.urlHint}>{resolvedUrl}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleReload}>
                  <Text style={styles.retryBtnText}>重试</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {/* Floating exit fullscreen button (in landscape this closes the preview since full screen is locked) */}
        {isFullScreen && (
          <TouchableOpacity
            style={[styles.fullScreenExit, { top:  -8 }]}
            onPress={() => (isLandscape ? onClose() : setIsFullScreen(false))}
            activeOpacity={0.8}
            accessibilityLabel={isLandscape ? "Close preview" : "Exit full screen"}
          >
            <Text style={styles.fullScreenExitText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <UrlChoiceModal
        visible={urlChoiceVisible}
        title="Localhost URL"
        description="This URL uses localhost/127.0.0.1. On this device you may not be able to reach it."
        originalUrl={pendingUrlChoice.current?.normalized ?? ""}
        vpnUrl={pendingUrlChoice.current && resolvePreviewUrl ? resolvePreviewUrl(pendingUrlChoice.current.normalized) : ""}
        onChooseVpn={handleUrlChoiceVpn}
        onChooseOriginal={handleUrlChoiceOriginal}
        onCancel={handleUrlChoiceCancel}
      />
    </Modal>
  );
}

const toolbarHeight = Platform.OS === "ios" ? 52 : 48;

function createPreviewStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.surfaceBg,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 8,
    backgroundColor: theme.surfaceBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    minHeight: toolbarHeight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.borderColor,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  closeText: {
    fontSize: 18,
    color: theme.textPrimary,
    fontWeight: "400",
  },
  urlBarWrap: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.borderColor,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  urlInput: {
    fontSize: 15,
    color: theme.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.borderColor,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  iconBtnDisabled: {
    opacity: 0.7,
  },
  iconBtnText: {
    fontSize: 22,
    color: theme.textPrimary,
    fontWeight: "300",
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    backgroundColor: theme.surfaceBg,
  },
  tabBarScroll: {
    flex: 1,
    maxWidth: "100%",
  },
  tabBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 8,
    backgroundColor: theme.borderColor,
    maxWidth: 85,
  },
  tabActive: {
    // no theme color - same neutral as inactive
  },
  tabText: {
    fontSize: 13,
    color: theme.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  tabTextActive: {
    color: theme.textPrimary,
    fontWeight: "600",
  },
  tabClose: {
    marginLeft: 4,
    padding: 2,
  },
  tabCloseText: {
    fontSize: 16,
    color: theme.textMuted,
    lineHeight: 16,
  },
  tabCloseTextActive: {
    color: theme.textPrimary,
  },
  addTabBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.borderColor,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  addTabText: {
    fontSize: 20,
    color: theme.textPrimary,
    fontWeight: "300",
    lineHeight: 22,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: theme.surfaceBg,
  },
  placeholderText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: "center",
  },
  webContainer: {
    flex: 1,
    position: "relative",
  },
  webviewWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  webviewWrapperHidden: {
    opacity: 0,
    zIndex: -1,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.surfaceBg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.surfaceBg,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.textMuted,
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: theme.danger,
    textAlign: "center",
  },
  urlHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textMuted,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: theme.accent,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
  },
  fullScreenExit: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  fullScreenExitText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "400",
  },
  });
}
