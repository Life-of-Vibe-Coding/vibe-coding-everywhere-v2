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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useTheme } from "../../theme/index";
import { UrlChoiceModal } from "./UrlChoiceModal";

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

export function PreviewWebViewModal({
  visible,
  url,
  title = "Preview",
  onClose,
  resolvePreviewUrl,
}: PreviewWebViewModalProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => createPreviewStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(() => url?.trim() ?? "");
  const [urlInputValue, setUrlInputValue] = useState(() => url?.trim() ?? "");
  /** Cache-bust key so each load hits the network; avoids showing stale page when server is terminated. */
  const [loadKey, setLoadKey] = useState(() => Date.now());
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [urlChoiceVisible, setUrlChoiceVisible] = useState(false);
  const pendingUrlChoice = useRef<{ normalized: string; thenApply: (u: string) => void } | null>(null);

  const applyUrl = (u: string) => {
    setCurrentUrl(u);
    setUrlInputValue(u);
    setError(null);
    setLoading(true);
    setLoadKey(Date.now());
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
    if (visible && url?.trim()) {
      const normalized = normalizeUrl(url.trim());
      promptLocalhostToVpn(normalized, applyUrl);
    }
  }, [visible, url, resolvePreviewUrl]);

  const handleGo = () => {
    Keyboard.dismiss();
    const raw = urlInputValue.trim();
    if (!raw) return;
    const normalized = normalizeUrl(raw);
    promptLocalhostToVpn(normalized, applyUrl);
  };

  const handleReload = () => {
    setError(null);
    setLoading(true);
    setLoadKey(Date.now());
  };

  const handleNavigationStateChange = (navState: { url?: string }) => {
    if (navState.url) {
      const clean = stripPreviewParam(navState.url);
      setCurrentUrl(clean);
      setUrlInputValue(clean);
    }
  };

  if (!visible) return null;

  const resolvedUrl = currentUrl || url?.trim() || "";
  const showWebView = resolvedUrl && !error;
  /** Base URL without our param; used for stable key so we don't remount and reload in a loop. */
  const baseUrl = stripPreviewParam(resolvedUrl) || resolvedUrl;
  /** Cache-busting URI so we always request from network; if server is down we get onError instead of cached page. */
  const loadUri =
    resolvedUrl && loadKey
      ? baseUrl + (baseUrl.includes("?") ? "&" : "?") + "_preview=" + loadKey
      : "";

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
        {/* Chrome-like toolbar */}
        <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityLabel="Close preview"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
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
            style={[styles.iconBtn, loading && styles.iconBtnDisabled]}
            onPress={handleReload}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityLabel="Reload"
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={styles.iconBtnText}>↻</Text>
            )}
          </TouchableOpacity>
        </View>

        {!resolvedUrl ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>输入网址后按键盘「前往」或点击刷新加载</Text>
          </View>
        ) : (
          <View style={styles.webContainer}>
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
            ) : (
              <WebView
                ref={webViewRef}
                key={loadKey ? `${loadKey}-${baseUrl}` : resolvedUrl}
                source={{ uri: loadUri }}
                style={styles.webview}
                onLoadStart={() => {
                  setLoading(true);
                  setError(null);
                }}
                onLoadEnd={() => {
                  setLoading(false);
                }}
                onError={(e) => {
                  setLoading(false);
                  const desc = e.nativeEvent?.description ?? "加载失败";
                  setError(desc);
                }}
                onHttpError={(e) => {
                  setLoading(false);
                  const status = e.nativeEvent?.statusCode;
                  setError(status ? `HTTP ${status}` : "加载失败");
                }}
                onNavigationStateChange={handleNavigationStateChange}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                scalesPageToFit
                mixedContentMode="compatibility"
                cacheEnabled={false}
                {...(Platform.OS === "android" ? { cacheMode: "LOAD_NO_CACHE" as const } : {})}
              />
            )}
          </View>
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
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
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
  });
}
