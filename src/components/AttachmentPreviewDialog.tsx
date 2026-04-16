import { useMemo } from "react";
import { ExternalLink, Download, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  filename?: string | null;
};

function getFileKind(nameOrUrl: string): "image" | "pdf" | "other" {
  const clean = nameOrUrl.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function AttachmentPreviewDialog({ open, onOpenChange, url, filename }: Props) {
  const kind = useMemo(() => (url ? getFileKind(filename ?? url) : "other"), [filename, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="border-b px-6 py-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{filename || "Attachment"}</span>
            </DialogTitle>
          </DialogHeader>
          {url ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in new tab
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={url} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          ) : null}
        </div>

        <div className={cn("bg-background", kind === "image" ? "p-4" : "p-0")}>
          {!url ? (
            <div className="p-6 text-sm text-muted-foreground">No attachment to preview.</div>
          ) : kind === "image" ? (
            <div className="flex items-center justify-center">
              <img src={url} alt={filename || "Attachment"} className="max-h-[75vh] w-auto max-w-full rounded-md border" />
            </div>
          ) : kind === "pdf" ? (
            <iframe title={filename || "Attachment"} src={url} className="h-[75vh] w-full" />
          ) : (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">Preview isn’t available for this file type.</p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="default">
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={url} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

