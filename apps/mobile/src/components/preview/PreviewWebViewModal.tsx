import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Platform,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import { UrlChoiceModal } from "@/components/preview/UrlChoiceModal";
import { PreviewWebViewTopBar, PreviewWebViewAddressBar } from "@/components/preview/PreviewWebViewSubcomponents";

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
  isOpen: boolean;
  url: string;
  title?: string;
  onClose: () => void;
  /** Resolver for localhost/127.0.0.1 -> tunnel URL. When set, prompts user to use tunnel URL when localhost is detected. */
  resolvePreviewUrl?: (url: string) => string;
}

interface TabState {
  id: string;
  url: string;
  loadKey: number;
}

export function PreviewWebViewModal({
  isOpen,
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
  const lastInitUrlRef = useRef<string>("");
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // Auto full screen only when phone is rotated to landscape (90°); portrait shows toolbar
  useEffect(() => {
    if (!isOpen) return;
    setIsFullScreen(isLandscape);
  }, [isOpen, isLandscape]);

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
    if (!isOpen) {
      initializedRef.current = false;
      lastInitUrlRef.current = "";
      setIsFullScreen(false);
      return;
    }
    const initialUrl = (url?.trim() ?? "") || "";
    const normalized = initialUrl ? normalizeUrl(initialUrl) : "";
    // Re-init when user clicks a new link (url prop changed while modal was open)
    if (normalized && lastInitUrlRef.current !== normalized) {
      initializedRef.current = false;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastInitUrlRef.current = normalized;

      (async () => {
        // When user explicitly clicks a link, always use that URL instead of restored tabs
        if (!normalized) {
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
            // Fall through to empty init
          }
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
  }, [isOpen, url, resolvePreviewUrl]);

  useEffect(() => {
    if (!isOpen || tabs.length === 0) return;
    const payload = {
      tabs: tabs.map((t) => ({ id: t.id, url: t.url })),
      activeIndex,
    };
    AsyncStorage.setItem(PREVIEW_TABS_KEY, JSON.stringify(payload)).catch(() => {});
  }, [isOpen, tabs, activeIndex]);

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

  if (!isOpen) return null;

  const resolvedUrl = currentUrl || "";

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={title}
      subtitle={resolvedUrl || "Web preview"}
      showHeader={false}
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
      <Box style={styles.safe}>
        {/* Chrome-like toolbar - hidden in full screen */}
        {!isFullScreen && (
          <>
            <PreviewWebViewTopBar
              insetsTop={insets.top}
              tabs={tabs}
              activeIndex={activeIndex}
              onClose={onClose}
              onAddTab={addTab}
              onCloseCurrentTab={() => closeTab(activeIndex)}
              onSelectTab={selectTab}
            />
            <PreviewWebViewAddressBar
              value={urlInputValue}
              onChangeText={setUrlInputValue}
              onSubmit={handleGo}
              onReload={handleReload}
              onFullscreen={() => setIsFullScreen(true)}
              resolvedUrl={resolvedUrl}
              loading={loading}
              theme={theme}
            />
          </>
        )}

        {!resolvedUrl ? (
          <Box style={styles.placeholder}>
            <Text style={styles.placeholderText}>Enter a URL and press Go or Reload to load the page</Text>
          </Box>
        ) : (
          <Box style={styles.webContainer}>
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
                <Box
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
                        const desc = e.nativeEvent?.description ?? "Failed to load";
                        setError(desc);
                      }
                    }}
                    onHttpError={(e) => {
                      if (i === activeIndex) {
                        setLoading(false);
                        const status = e.nativeEvent?.statusCode;
                        setError(status ? `HTTP ${status}` : "Failed to load");
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
                </Box>
              );
            })}
            {loading && (
              <Box style={styles.loadingOverlay}>
                <Spinner size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading...</Text>
              </Box>
            )}
            {error ? (
              <Box style={styles.errorOverlay}>
                <Box style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Could not load page</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.urlHint} numberOfLines={2}>
                    {resolvedUrl}
                  </Text>
                  <Pressable style={styles.retryBtn} onPress={handleReload} accessibilityRole="button" accessibilityLabel="Retry">
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </Pressable>
                </Box>
              </Box>
            ) : null}
          </Box>
        )}

        {/* Floating exit fullscreen button (in landscape this closes the preview since full screen is locked) */}
        {isFullScreen && (
          <Pressable
            style={[styles.fullScreenExit, { top: insets.top }]}
            onPress={() => (isLandscape ? onClose() : setIsFullScreen(false))}
            accessibilityLabel={isLandscape ? "Close preview" : "Exit full screen"}
            accessibilityRole="button"
          >
            <Text style={styles.fullScreenExitText}>✕</Text>
          </Pressable>
        )}
      </Box>

      <UrlChoiceModal
        isOpen={urlChoiceVisible}
        title="Localhost URL"
        description="This URL uses localhost/127.0.0.1. On this device you may not be able to reach it."
        originalUrl={pendingUrlChoice.current?.normalized ?? ""}
        vpnUrl={pendingUrlChoice.current && resolvePreviewUrl ? resolvePreviewUrl(pendingUrlChoice.current.normalized) : ""}
        onChooseVpn={handleUrlChoiceVpn}
        onChooseOriginal={handleUrlChoiceOriginal}
        onCancel={handleUrlChoiceCancel}
      />
    </ModalScaffold>
  );
}

function createPreviewStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: theme.colors.surfaceAlt,
  },
  placeholderText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.surfaceAlt,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.94)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 4,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 5,
  },
  errorBox: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.danger,
    textAlign: "center",
  },
  urlHint: {
    marginTop: 10,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 18,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
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
