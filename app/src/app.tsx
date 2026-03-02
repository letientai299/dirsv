import { useEffect, useState } from "preact/hooks";
import { DirView } from "./views/dir-view";
import { FileView } from "./views/file-view";
import { browse, type BrowseResponse } from "./lib/api";

export function App() {
  const [path, setPath] = useState(location.pathname);
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onPopState = () => setPath(location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    browse(path)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [path]);

  const navigate = (to: string) => {
    history.pushState(null, "", to);
    setPath(to);
  };

  if (error) return <div class="error">Error: {error}</div>;
  if (!data) return <div class="loading">Loading...</div>;

  if (data.type === "dir") {
    return <DirView path={path} entries={data.entries} onNavigate={navigate} />;
  }

  return <FileView path={path} />;
}
