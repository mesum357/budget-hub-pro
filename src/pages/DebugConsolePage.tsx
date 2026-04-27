import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug, Trash2, Copy, Download } from "lucide-react";
import { clearDebugEntries, getDebugEntries, subscribeDebugEntries, type DebugEntry } from "@/lib/debugConsole";

type Props = {
  mode: "admin" | "sub";
};

const levelClass: Record<string, string> = {
  error: "text-destructive",
  warn: "text-warning",
  info: "text-info",
  debug: "text-info",
  log: "text-foreground",
};

function fmt(entry: DebugEntry) {
  const ts = new Date(entry.ts).toLocaleTimeString();
  return `[${ts}] [${entry.level.toUpperCase()}] ${entry.message}`;
}

export default function DebugConsolePage({ mode }: Props) {
  const [entries, setEntries] = useState<DebugEntry[]>(() => getDebugEntries());
  const [copied, setCopied] = useState(false);
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;

  useEffect(() => {
    return subscribeDebugEntries(() => setEntries(getDebugEntries()));
  }, []);

  const logText = useMemo(() => entries.map(fmt).join("\n"), [entries]);
  const exportLogs = () => {
    const blob = new Blob([logText || "(no logs)"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `debug-console-${mode}-${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logText || "(no logs)");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DashboardLayout title="Debug Console" mode={mode}>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {!isMobile ? (
          <Card>
            <CardHeader>
              <CardTitle>Mobile Only</CardTitle>
              <CardDescription>This debug page is intended for mobile testing sessions.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="ui-card-interactive">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-muted-foreground" />
                In-App Console
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyLogs}>
                  <Copy className="h-4 w-4 mr-1" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportLogs}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={clearDebugEntries}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
            <CardDescription>
              Captures <code>console.log/warn/error/info</code>, runtime errors, and unhandled promise rejections in this browser tab.
            </CardDescription>
            <CardDescription>Total entries: {entries.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="max-h-[70vh] overflow-auto font-mono text-xs space-y-2">
                {entries.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet. Reproduce the issue and return here.</p>
                ) : (
                  entries
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <pre key={entry.id} className={`whitespace-pre-wrap break-words ${levelClass[entry.level] || "text-foreground"}`}>
                        {fmt(entry)}
                      </pre>
                    ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

