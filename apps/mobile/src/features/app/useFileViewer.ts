import { useCallback, useEffect, useState } from "react";

type ServerConfig = {
  getBaseUrl: () => string;
};

type WorkspaceFileService = {
  fetchFile: (path: string) => Promise<{ content: string; isImage: boolean }>;
};

type UseFileViewerReturn = {
  selectedFilePath: string | null;
  fileContent: string | null;
  fileIsImage: boolean;
  fileLoading: boolean;
  fileError: string | null;
  openFile: (path: string) => void;
  closeFileViewer: () => void;
};

export function useFileViewer({
  workspaceFileService,
  serverConfig,
}: {
  workspaceFileService: WorkspaceFileService;
  serverConfig: ServerConfig;
}): UseFileViewerReturn {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileIsImage, setFileIsImage] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFilePath) return;
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    setFileIsImage(false);

    if (selectedFilePath.startsWith("__diff__:staged:") || selectedFilePath.startsWith("__diff__:unstaged:")) {
      const isStaged = selectedFilePath.startsWith("__diff__:staged:");
      const file = selectedFilePath.substring(`__diff__:${isStaged ? "staged" : "unstaged"}:`.length);
      fetch(`${serverConfig.getBaseUrl()}/api/git/diff?staged=${isStaged}&file=${encodeURIComponent(file)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setFileContent(data.diff || "(No differences)");
          setFileLoading(false);
        })
        .catch((err) => {
          setFileError(err?.message ?? "Failed to load diff");
          setFileLoading(false);
        });
      return;
    }

    workspaceFileService
      .fetchFile(selectedFilePath)
      .then(({ content, isImage }) => {
        setFileContent(content);
        setFileIsImage(isImage);
        setFileLoading(false);
      })
      .catch((err) => {
        setFileError(err?.message ?? "Failed to load file");
        setFileLoading(false);
      });
  }, [selectedFilePath, workspaceFileService, serverConfig]);

  const openFile = useCallback((path: string) => {
    setSelectedFilePath(path);
  }, []);

  const closeFileViewer = useCallback(() => {
    setSelectedFilePath(null);
    setFileContent(null);
    setFileIsImage(false);
    setFileError(null);
  }, []);

  return {
    selectedFilePath,
    fileContent,
    fileIsImage,
    fileLoading,
    fileError,
    openFile,
    closeFileViewer,
  };
}
